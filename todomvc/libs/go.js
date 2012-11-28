
/*
*   GoJS 0.7.85
*   Dependencies: jQuery 1.5+
*
*   GoJS is a full-featured MVC framework that provides support for controllers, actions, views, models, routing,
*   deep linking, back/front button support, loading indication, resource loading, template rendering, and more.
*/

//Public objects
{
    //Core object for access to static methods
    var Go = {};

    //Controller
    var Controller = function (ctrlName, items) {
        return this.construct(ctrlName, items);
    };

    //Action
    var Action = function (props) {
        return this.construct(props);
    };

    //ActionEvent
    var ActionEvent = function (props) {
        return this.construct(props);
    };
}

//GoJS Core
Go = (function () {

    var go = {};

    /***** Init *****/
    {
        //Private fields
        var _controllers = {},  //Controllers
            _templates = {},    //Cached template rendering functions
            _updaters = {},     //Custom update functions
            _events = [],       //Global events
            _clickHold,         //Prevents double clicks
            _requestHold,       //Prevents request
            _content;           //Main content area

        //Default config
        var _config = {
            //Routes
            routes: [],
            //Settings
            autoActivateViews: true, //Automatically activate every link and form
            autoCorrectLinks: true, //Change standard URL's to ajax (#) URL's
            contentSelector: "[go-content]", //The main content area
            defaultContentUrl: null, //URL to request if content area is empty on page load
            submitFilter: null, //Don't submit any form elements that match this
            loadingIndicatorCSS: "", //CSS style for the loading indicator
            //Resource Routes
            scriptRoute: "/scripts/{key}.js",
            styleRoute: "/styles/{key}.css",
            viewRoute: "/views/{key}.html"
            //TODO: Include auto-load in framework?
            //controllerRoute: "/Scripts/Controllers/{key}Controller.js",
            //controllerStyleRoute: "/Styles/Views/{key}.css",
            //modelRoute: "/Scripts/Models/{key}Models.js"
        };

        //Properties
        go.isRequesting = false; //Is making a request
    }

    /***** Public Methods *****/
    {
        //Run Action
        go.run = function () {

            //Arguments
            var args = arguments,
                a1 = args[0],
                a2 = args[1],
                a3 = args[2];

            //Argument is an ActionEvent
            if (a1 instanceof ActionEvent) handleRun(a1);

            //Arguments are controllerName, actionName and values
            else {

                //Create ActionEvent object
                var e = new ActionEvent({
                    values: extend(a3, {    //values
                        controller: a1,     //controllerName
                        action: a2          //actionName
                    })
                });
                handleRun(e);
            }

        };

        //Get
        go.get = function (url, callback) {
            go.request({ url: url, response: callback });
        };

        //Post
        go.post = function (url, data, callback) {
            go.request(url, {
                isPost: true,
                postData: data,
                response: callback
            });
        };

        //Request 
        go.request = function (url, options) {
            handleRequest(url, options);
        };

        //Reload
        go.reload = function (redirect, enableSSL) {
            //Locals
            var protocol = location.protocol,
                host = location.host;
            //Show progress
            go.loading.show();
            //Hold any requests
            _requestHold = formatURL(redirect);
            //If protocol is changing, change entire href
            if ((protocol == "http" && enableSSL) || (protocol == "https" && !enableSSL)) {
                location.href = "http" + (enableSSL ? "s" : "") + "://" + host + "#" + newHash;
            }
            //Else change hash and reload
            {
                //Must use $location.hash, not $hash
                location.hash = _requestHold;
                location.reload();
            }
        };

        //Get/Set config
        go.config = function (config) {
            //Get
            if (!config) return _config;
            //Set
            else for (var key in config) {
                var val = config[key];
                //Join arrays
                if (isArray(val) && isArray(_config[key])) {
                    _config[key] = _config[key].concat(val);
                }
                //Assign other values
                else _config[key] = val;
            }
        };

        //Set routes
        go.route = function (routes) {
            _config.routes = _config.routes.concat(routes);
        };

        //Add event
        go.on = function () {
            var args = arguments,
               events = getArg(args, "string", 1).split(",");
            $(events).each(function () {
                var event = $.trim(this).toLowerCase();
                _events.push({
                    type: event,
                    event: getArg(args, "function", 1),
                    route: getArg(args, "string", 2)
                });
            });
        };

        //Add Updaters
        go.addUpdaters = function (updaters) {
            _updaters = extend(_updaters, updaters);
        };
    }

    /***** Constructors *****/
    {
        //Construct objects internally for access to private functions

        Controller.prototype.construct = function (ctrlName, items) {

            //Create controller object
            var ctrl = {
                name: ctrlName,
                //Hash object to store actions
                actions: {}
            };

            //Add each action to controller
            for (var key in items) {

                var item = items[key];

                //If function, then convert to action
                if (isFunction(item)) {
                    item = new Action({
                        complete: item
                    });
                }

                //If is Action, add to actions collection
                if (item instanceof Action) {

                    //Add properties to action
                    var action = extend(item, {
                        controller: ctrl,
                        name: key
                    });

                    //Add action to controller "actions" collection
                    ctrl.actions[key] = action;

                    //Add action route
                    //Important, add action routes at beginning of collection so other routes are overridden
                    var route = action.route;
                    if (route) {
                        //String
                        if (isString(route)) _config.routes.unshift({ route: route, defaults: { controller: ctrlName, action: key} });
                        //Object
                        else _config.routes.unshift(route);
                    }

                }

                //Else just add item to controller
                //Normally, functions would be added as helpers in this case
                else ctrl[key] = item;

            };

            //Add each action shortcut method
            //Allows for MyController.list() rather than Go.run("MyController", "list")
            //Only add if controller property name does not already exist
            //Important! Must use separate function for key to resolve correctly
            for (var key in ctrl.actions) addShortcut(ctrl, key);
            function addShortcut(ctrl, actionName) {
                if (!ctrl[actionName]) {
                    ctrl[actionName] = function (values) {
                        go.run(ctrl.name, actionName, values);
                    };
                }
            }

            //Add controller to collection
            _controllers[ctrlName] = ctrl;

            //Return controller for chaining
            return ctrl;

        };

        Action.prototype.construct = function (options) {
            return extend(this, options);
        };

        ActionEvent.prototype.construct = function (options) {
            return extend(this, options);
        };
    }

    /***** Handlers *****/
    {
        function handleReady(e) {

            //Register all styles and scripts on page
            //Prevents from loading again
            $("script[src]").each(function () { _loadedResources[$(this).attr("src")] = true; });
            $("link[href]").each(function () { _loadedResources[$(this).attr("href")] = true; });

            //Find and cache content area
            _content = $(_config.contentSelector);

            //Create ActionEvent object
            //URL is either current hash or "/" by default
            var e = new ActionEvent({
                element: $(document),
                url: formatURL(location.hash) || "/"
            });
            getRouteValuesFromUrl(e);

            //EVENT: ready
            triggerEvents("ready", e);

            //Activate entire document
            runNextHandler(handleActivate, e);

            //Handle initial hash value
            requireAll(e, function () {
                //Empty content area
                _content.empty();
                //Don't start if url is held
                if (_requestHold == e.url) _requestHold = null;
                //Goto start
                else handleRun(e);
            });

            //Request default content URL if nothing is being requested and content is empty
            //TODO: Remove this?
            setTimeout(function () {
                var url = _config.defaultContentUrl;
                if (url && !Go.isRequesting && !_content.find("*").length) {
                    handleRun({ url: url });
                }
            }, 500);

        }

        function handleRun(e) {

            if (e.url) {

                //Ensure proper URL format
                e.url = formatURL(e.url);

                //Get route values
                getRouteValuesFromUrl(e);

            };

            //EVENT: run
            triggerEvents("run", e);

            //Load all resources
            requireAll(e, function () {

                //If action exists, or can location action
                if (e.action || tryLocateAction(e)) {

                    //Load all resources
                    requireAll(e, function () {

                        //If "action.remote" then make request
                        //Assume all other actions are local otherwise
                        //TODO: Add global config to set all remote
                        if (e.action.remote) runNextHandler(handleRequest, e);

                        //If not remote, the just goto render
                        else runNextHandler(handleRender, e);

                    });

                }

                //Show error if action not found
                else showError("Action \"" + e.values.action + "\" on controller \"" + e.values.controller + "\" was not found.");

            });

        }

        function handleRequest(e) {

            //Locals
            var action = e.action,
                sender = $(e.sender),
                postData = e.postData,
                isPost = e.isPost || (postData != undefined && postData != null),
                remote = action && action.remote,
                remoteURL;

            //Resolve remote url
            var remoteURL = isFunction(remote) ? remote(e) : //Run if function
                            isString(remote) ? remote : //Use self if string
                            e.url; //Use URL is anything else

            //Confirm request
            if (!confirmAction(e.sender)) return false;

            //Show loading indicator
            go.loading.show();

            //EVENT: request
            triggerEvents("request", e);

            //Serialize post data
            //TODO: Check to see if this is needed
            if (isPost && postData && isString(postData)) postData = $.param(postData);

            //Signify request is in progress
            go.isRequesting = true;

            //Make request
            $.ajax({
                url: remoteURL,
                type: isPost ? "post" : "get",
                data: postData,
                cache: false,
                success: function (data, status, xhr) {

                    //Update properties
                    extend(e, {
                        data: data,
                        status: status,
                        xhr: xhr
                    });

                    //Response
                    runNextHandler(handleResponse, e);

                },
                error: function (xhr, status, error) {

                    //Update properties
                    extend(e, {
                        error: error,
                        status: status,
                        xhr: xhr
                    });

                    //Error
                    runNextHandler(handleRequestError, e);

                }
            });

        }

        function handleRequestError(e) {

            //Enable sender
            go.utils.toggleSender(e.sender, true);

            //EVENT: error
            triggerEvents("error", e);

            //Hide progress
            go.loading.hide();

            //Signify request is complete
            go.isRequesting = false;

        }

        function handleResponse(e) {

            //Locals
            var response = e.data,
                contentType = (e.xhr.getResponseHeader("content-type") || "").toLowerCase(),
                scripts = [];

            //Update properties
            extend(e, {
                contentType: contentType,
                isHTML: (/html/i).test(contentType),
                isJSON: (/json/i).test(contentType)
            });

            //Some other response type, Check for JSON
            //Attempt to parse, continue on exception
            if (!e.isHTML && !e.isJSON) {
                try {
                    e.data = $.parseJSON(e.data);
                    e.isJSON = true;
                } catch (e) { }
            }

            //EVENT: response
            triggerEvents("response", e);

            //HTML response
            if (e.isHTML) {

                //Store any views
                //TODO: Is this needed?
                $(response).filter("[view]").each(function () {
                    go.storage.store(this.getAttribute("view"), this.outerHTML);
                });

                //Update each HTML element
                //TODO: Move this
                $(response).filter("[data-update]:not([view])").each(function () {
                    e.element = this;
                    handleUpdate(e);
                });

                //Check for removed content dependencies
                $("[data-dependent]").each(function () {
                    var el = $(this);
                    var dependent = $(el.attr("data-dependent"));
                    //Remove element of dependent does not exist
                    if (!dependent.length) el.remove();
                });

                //Run inline scripts
                $(response).filter("script:not([src])").each(function () {
                    $.globalEval($(this).html());
                });

            }

            //JSON response
            else if (e.isJSON) {

                //Success
                if (e.data.success === true) runNextHandler(handleSuccess, e);

                //Error
                else if (e.data.success === false) runNextHandler(handleError, e);

            }

            //Hide progress
            go.loading.hide();

            //Signify request is complete
            go.isRequesting = false;

            //If HTML response, then attempt to update
            if (e.isHTML && e.updater) {
                e.element = response;
                runNextHandler(handleUpdate, e);
            }

            //Handle render if view is specified
            else if (tryGetProperty(e, "action.view")) runNextHandler(handleRender, e);

            //Else handle complete
            else runNextHandler(handleComplete, e);
        }

        function handleSuccess(e) {

            //EVENT: success
            triggerEvents("success", e);

        }

        function handleError(e) {

            //Add error(s) props to "e" for easy access
            extend(e, e.data, "error,errors");

            //EVENT: error
            triggerEvents("error", e);

        }

        function handleRender(e) {

            //Locals
            var action = e.action,
                view = action.view;

            //If no view, then goto complete
            if (!view) {
                runNextHandler(handleComplete, e);
                return;
            }

            //Replace {controller} and {action} tokens with controller name
            //TODO: Allow for any route param to be merged with token
            view.replace("{controller}", e.values.controller).replace("{action}", e.values.action);

            //Ensure view is loaded
            go.require({ views: view }, function () {

                //Get model
                var model = resolveModel(e);

                //Render the template if model is provided
                //TODO: Should template be rendered if no model? Then view property can't be used in some cases
                e.element = go.templates.render(view, model || {});

                //EVENT: render
                triggerEvents("render", e);

                //Update the rendered element
                runNextHandler(handleUpdate, e);

            });

        }

        function handleUpdate(e) {

            //Locals
            var action = e.action,
                element = $(e.element),
                id = element.attr("id"),
                updater = e.updater;

            //TODO: Remove the need for element update data in future
            //Get updater properties
            var updateData = element.data() || {},
                updaterName = updater ? (isString(e.updater) ? e.updater : e.updater.name).toLowerCase()
                              : updateData.update.toLowerCase();
            if (isPlainObject(updater)) extend(updateData, updater);
            if (e.isHTML && updateData.update) {
                updaterName = updateData.update;
            }

            //Ensure "updater" property is provided
            //Match by lowercase
            if (!updaterName) return;
            else updaterName = updaterName.toLowerCase();

            //Ensure element has id
            if (id == "" || id == undefined) {
                id = go.utils.createRandomId();
                element.attr("id", id);
            }

            //Update properties
            extend(e, {
                updateData: updateData,
                updateId: id,
                element: element
            });

            //EVENT: updating
            triggerEvents("updating", e);

            //Hide update
            element.hide();

            //Check custom updaters
            var isUpdated = false;
            for (var item in _updaters) {
                if (item.toLowerCase() == updaterName) {
                    //Run custom updater
                    _updaters[item](e);
                    isUpdated = true;
                    continue;
                }
            }

            //Check standard updates
            //content, replace, insert, append, prepend, after, before
            //TODO: Move window to updaters
            if (!isUpdated) {
                switch (updaterName) {
                    //Content                                                                                                                                                                                                                                                                                                                                      
                    /*  
                    *   title: {string} 
                    *   address: {string} 
                    */ 
                    case "content":
                        //TODO: Move address/title to complete?
                        //Address
                        go.setAddress(e.address || e.url);
                        //Page Title
                        var title = evalFunc(e.title, e);
                        if (title) document.title = title;
                        //Content
                        $(_config.contentSelector).empty().append(element);
                        //Scroll to top by default
                        if (!updateData.scroll && isFunction(scrollTo)) $(window).scrollTop(0);
                        break;
                    //Replace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
                    case "replace":
                        $("#" + id).replaceWith(element);
                        break;
                    //Insert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
                    /*
                    *   target: {selector}
                    */ 
                    case "insert":
                        var target = $(updateData.target);
                        target.html(element);
                        break;
                    //Prepend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
                    /*
                    *   target: {selector}
                    */ 
                    case "prepend":
                        var existing = $("#" + id);
                        if (existing.length) existing.replaceWith(element);
                        else $(updateData.target).prepend(element);
                        break;
                    //Append                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
                    /*
                    *   target: {selector}
                    */ 
                    case "append":
                        var existing = $("#" + id);
                        if (existing.length) existing.replaceWith(element);
                        else $(updateData.target).append(element);
                        break;
                    //After                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
                    /*
                    *   target: {selector}
                    */ 
                    case "after":
                        var target = $(updateData.target);
                        target.after(element);
                        break;
                    //Before                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
                    /*
                    *   target: {selector}
                    */ 
                    case "before":
                        var target = $(updateData.target);
                        target.before(element);
                        break;
                }
            }

            //EVENT: updated
            triggerEvents("updated", e);

            //Show update
            element.show();

            //Activate the view
            runNextHandler(handleActivate, e);

        }

        function handleActivate(e) {

            //Locals
            var element = e.element;

            //EVENT: activate
            triggerEvents("activate", e);

            //Run activator
            go.activator.run(element);

            //Run complete handler
            runNextHandler(handleComplete, e);

        }

        function handleComplete(e) {

            //Enable sender
            go.utils.toggleSender(e.sender, true);

            //EVENT: complete
            triggerEvents("complete", e);

        }
    }

    /***** Require *****/
    {
        //TODO: Add support for other resources such as images

        //Hashes of currently loading/loaded resources
        var _loadedResources = {},
            _viewIds = {};

        //Require one or more resources
        go.require = function (require, callback) {

            //Evaluate if function
            require = evalFunc(require);

            //Convert script or array to object
            //Assume they are scripts in this case
            if (isString(require) || isArray(require))
                require = { scripts: require };

            //Locals
            var resources = [],
                callback = callback || function () { };

            //If require is null or undefined, just run callback
            if (!require) {
                callback();
                return;
            }

            //Check for child dependencies
            var child = require.require;
            if (child) go.require(child, function () {
                getResources(require, callback);
            });

            //Else just get resources
            else getResources(require, callback);

        };

        function getResources(require, callback) {

            //Locals
            var resources = [],
                total;
            callback = callback || function () { };

            //Add resources to single array
            $(getStringArray(require.scripts)).each(function () {
                resources.push({ key: this, script: true });
            });
            $(getStringArray(require.styles)).each(function () {
                resources.push({ key: this, style: true });
            });
            $(getStringArray(require.views)).each(function () {
                resources.push({ key: this, view: true });
            });
            total = resources.length;

            //If no resources, just run callback
            if (total == 0) {
                callback();
                return;
            }

            //Check if all resources have been loaded
            //Then run callback if so
            var checkForCompletion = function () {
                total--;
                if (total == 0) {
                    //Hide loading indicator
                    go.loading.hide();
                    //Run callback
                    callback();
                }
            };

            //Show loading indicator
            go.loading.show();

            //Load each resource
            $(resources).each(function () {

                //Locals
                var resource = this,
                    url = resource.key; //Assume key is the url

                //Combine with key with route config if local resource
                if (!(/^http:\/\/|^https:\/\//).test(url)) {
                    var route = resource.script ? _config.scriptRoute :
                                resource.style ? _config.styleRoute :
                                resource.view ? _config.viewRoute :
                                undefined;
                    if (route) url = route.replace("{key}", url).replace("//", "/");
                }

                //Ensure resource is only loaded once
                if (_loadedResources[url]) {
                    checkForCompletion();
                    return;
                };

                //Set as loaded now, can remove on error
                _loadedResources[url] = true;

                //Error callback, load failed
                var onError = function () {
                    delete _loadedResources[url];
                    showError("Resource \"" + url + "\" was not found.");
                };

                //Script or Style
                //Add tag to head of page
                if (resource.script || resource.style) {

                    //Locals
                    var el,
                        isScript = resource.script,
                        isStyle = resource.style;

                    //Create script/link element to add to DOM
                    var el;
                    if (isScript) {
                        el = $("<script><\/script>");
                        el.attr({ src: url, type: "text/javascript", async: "async" });
                    }
                    else {
                        el = $('<link\/>');
                        el.attr({ href: url, rel: "stylesheet" });
                    }

                    //Load event
                    el.load(function () {

                        //Run callback if all have been loaded
                        checkForCompletion();

                    });

                    //Error event
                    el.error(onError);

                    //Show loading indicator
                    go.loading.show();

                    //Add element to head
                    $('head')[0].appendChild(el[0]);

                }

                //View
                else if (resource.view) {

                    //Load with Ajax
                    $.ajax({
                        type: "get",
                        url: url,
                        error: onError,
                        success: function (response) {

                            //Multiple views can be returned in one request
                            //The id should be specified in this case by "view" attribute
                            $(response).each(function () {

                                //Locals
                                var el = $(this);

                                //View id is either the resource key 
                                //or the "view" attribute on the element
                                var viewId = (el.attr("view") || resource.key);

                                //Only store if item has HTML
                                //jQuery returns text nodes also
                                if (el.length && el[0].outerHTML) {

                                    //Store view id
                                    _viewIds[viewId] = true;

                                    //Store compiled view
                                    go.templates.store(viewId, el);

                                }

                            });

                            //Run callback if all have been loaded
                            checkForCompletion();
                        }
                    });

                }

            });

        };
    }

    /***** Address, Deep-Linking *****/
    {
        //TODO: Fix last forward button issue

        //URL was just changed to this value
        var _currentAddress;

        //Set the current address
        go.setAddress = function (address) {
            var address = formatURL(address),
                hash = formatURL(location.hash);
            if (hash != address) {
                _currentAddress = address;
                if (address == "/") location.hash = "";
                else location.hash = trimChars(address, "/");
            }
        };

        //Run callback when hash or address has changed
        //TODO: Implement HTML5 push state
        function runAddressChangeCallback(address) {
            var address = formatURL(location.hash);
            //If address is not current address and isn't held, then run action
            if (address != _requestHold && address != _currentAddress) {
                handleRun({ url: address });
            }
        }

        //Native hash change event
        if (("onhashchange" in window) && !($.browser.msie && parseInt($.browser.version, 10) < 8)) {
            $(window).bind("hashchange", runAddressChangeCallback);
        }

        //If no hashchange event, or is IE7 and below, must use polling
        else {
            var prevHash = location.hash;
            setInterval(function () {
                //Compare the current hash with previous
                var curHash = location.hash;
                if (curHash != prevHash) {
                    runAddressChangeCallback();
                    prevHash = curHash;
                }
            }, 100);
        }

    }

    /***** Private Methods *****/
    {
        //Get route values from URL
        //Adds values to e, return true if found
        //TODO: Return route object instead?
        function getRouteValuesFromUrl(e) {

            //Prevent from running twice
            if (e.routeMatched != undefined) return e.routeMatched;

            //Ensure values is initialized
            e.values = (e.values || {});

            //Locals
            var url = trimChars(e.url, "/"),
                routes = _config.routes,
                length = routes.length;

            //Query string
            if (/\?/.test(url)) {

                //Split string from path
                var parts = url.split("?");
                    params = parts[1].split("&");

                //Reassign URL path
                url = trimChars(parts[0], "/");

                //Add params to e.values
                for (var i = 0; i < params.length; i++) {
                    var pair = params[i].split("=");
                    e.values[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }

            }

            //Convert empty path to default "/"
            url = url || "/"

            //Exit on empty arguments
            if (!url || !routes) return;

            //Check each route, take first match
            for (var i = 0; i < length; i++) {

                //Locals
                var routeObj = routes[i],
                    route = trimChars(routeObj.route, "/") || "/",
                    require = routeObj.require,
                    defaults = routeObj.defaults,
                    paramRegex = /{[\w\d_]+}/ig,
                    routeRegex = new RegExp("^" + route.replace(paramRegex, "([^\\/]+)") + "$", "i"),
                    vals = e.values;

                //Check URL with regex
                if (routeRegex.test(url)) {

                    //Add require to event only if it doesn't exist
                    if (!e.require && require) e.require = require;

                    //Merge values with defaults
                    vals = extend(vals, defaults);

                    //Get param names
                    var paramNames = route.match(paramRegex);

                    //Route might not contain any params
                    if (paramNames) {

                        //Remove curly brackets from names
                        trimChars(paramNames, "{}");

                        //Get param values
                        //Skip first item in array, Only take param matches
                        var paramValues = url.match(routeRegex).slice(1);
                        for (var i = 0; i < paramNames.length; i++) {
                            vals[paramNames[i]] = paramValues[i];
                        }

                    }

                    //Success, Route has been matched
                    //Return true only if controller and action found
                    if (vals.controller && vals.action) {
                        e.routeMatched = true;
                        e.route = route;
                        return true;
                    }
                }
            }

            //No matching route found
            e.routeMatched = false;
            return false;
        }

        //Try to locate a controller and action
        function tryLocateAction(e) {
            //Try to match controller/action
            var ctrl = findPropIgnoreCase(_controllers, e.values.controller), action;
            if (ctrl) action = findPropIgnoreCase(ctrl.actions, e.values.action);
            //Match found, add values to event
            if (action) {
                //Add specific action properties to "e"
                //Allows for easier access... e.view rather than e.action.view
                //Need to avoid certain props such as require and events
                //TODO: Add additional props in future
                extend(e, action, "model,view,controller,remote,updater,title,address,menu");
                //Add properties to "e"
                e.controller = ctrl;
                e.action = action;
                //Return true if located
                return true;
            }
        }

        //Resolve model from property and response
        function resolveModel(e) {

            //Locals
            var model,
                modelType = e.action.model,
                data = e.data || null;

            //Model is function, execute with e as argument 
            if (isFunction(modelType)) model = modelType.call(e, e);

            //Model is object, combine
            else if (typeof modelType == "object") model = extend(data, modelType);

            //Assign resolved model
            if (model) e.model = model;

            return model;
        }

        //Trigger events on e, controller or action
        //Trigger events added by "on" method
        function triggerEvents(eventType, e) {

            //Context, try to get controller
            //Use window if controller not available
            var values = e.values,
                controller = (e.controller || //Try first
                             e.values ? findPropIgnoreCase(_controllers, e.values.controller) : false || //Try to resolve if not exists
                             window); //Else, just use window

            //Try to run events added by "on" method
            $(_events).each(function () {
                //Check for event type
                if (this.type == eventType) {
                    //Check for route
                    //Exit loop if route exists and doesn't match
                    if (this.route) {
                        var regex = new RegExp(this.route, "i");
                        if (!regex.test(e.url)) return;
                    }
                    //Call function
                    this.event.call(controller, e);
                }
            });

            //Try to run event on "e" object
            tryCallFunction(e, eventType, e, e);

            //Try to run event on "action" object
            tryCallFunction(e, "action." + eventType, e, e);

        }

        //Run the next step, can be canceled or delayed
        function runNextHandler(nextHandler, e) {

            //If e.cancel, then exit process
            if (e.cancel) return;

            //If e.delay, then wait
            else if (e.delay) {
                setTimeout(function () { nextHandler(e); }, e.delay);
                delete e.delay;
            }

            //Run normally
            else nextHandler(e);

        }

        //Load all required resources for an event
        //Load required on event, controller and action
        function requireAll(e, callback) {
            //e.require
            go.require(e.require, function () {
                //e.controller.require
                go.require(tryGetProperty(e, "controller.require"), function () {
                    //e.action.require
                    go.require(tryGetProperty(e, "action.require"), function () {
                        callback();
                    });
                });
            });
        }
    }

    /***** Helpers *****/
    {
        //Confirm
        //Use data-confirm="true", data-confirm="{action}", or data-confirm="{message}"
        function confirmAction(sender) {
            if (isFunction(confirm) && sender) {
                var sender = $(sender),
                    val = sender.attr("data-confirm");
                if (!val) val = sender.find("submit:first").attr("data-confirm");
                if (val) {
                    if (val == "true" && !confirm("Are you sure you want to do this?")) return false;
                    if (val.indexOf(" ") == -1 && !confirm("Are you sure you want to " + val + "?")) return false;
                    if (val.indexOf(" ") > -1 && !confirm(val)) return false;
                }
            }
            return true;
        }

        //Try to get a global or namespaced property or nested property by string
        function tryGetProperty(obj, name) {
            if (obj && name) {
                $(name.split(".")).each(function () {
                    var prop = $.trim(this);
                    if (obj) obj = obj[prop];
                });
                return obj;
            }
        }

        //Call a global or namespaced function by string
        //Returns true if the function was called
        function tryCallFunction(obj, name, context, args) {
            var func = tryGetProperty(obj, name);
            //Run method, use context for "this" value
            if (isFunction(func)) {
                func.call(context, args);
                return true;
            }
        }

        //Get the N argument of a certain type
        function getArg(args, type, number) {
            var count = 1, number = (number || 1);
            for (var i = 0; i < args.length; i++) {
                //Check for type, If function then ensure "callee" is excluded
                if (typeof args[i] == type && !(type == "function" && args[i].name == "callee")) {
                    if (number == 1) return args[i];
                    else number++;
                }
            }
        }

        //Trim multiple characters from end of string or array of strings
        function trimChars(str, chars) {
            if (!str) return "";
            //Create regex to trim with
            //"{}" would produce "^{|{$|^}|}$"
            var regex = "";
            $(chars.split('')).each(function (index, value) {
                regex += "^" + value + "|" + value + "$|";
            });
            regex = new RegExp(regex, "ig");
            //Replace chars
            if ($.isArray(str))
                $(str).each(function (index, value) {
                    str[index] = value.replace(regex, "");
                });
            else str = str.replace(regex, "");
            return str;
        }

        //Find first property on object ignoring case
        function findPropIgnoreCase(obj, propName) {
            if (!propName) return;
            for (var key in obj) {
                if (key.toLowerCase() == propName.toLowerCase()) return obj[key];
            }
        }

        //Return an array of lowercase, trimmed strings
        //Items can be a single string, a comma delimited array, or an array
        function getStringArray(items) {
            //Return empty array if undefined or null
            if (!items) return [];
            //If string, split by commas
            if (isString(items)) items = items.split(",");
            //Trim and convert all to lowercase
            var length = items.length;
            for (var i = 0; i < length; i++) items[i] = $.trim(items[i].toString());
            return items;
        }

        //Extend one object with another
        //Props is a comma delimited whitelist
        function extend(obj1, obj2, props) {
            if (props) {
                $(props.split(",")).each(function (i, val) {
                    if (obj2[val]) obj1[val] = obj2[val];
                });
            }
            else return $.extend(obj1, obj2);
        }

        //Show an error message to developer
        function showError(error) {
            go.loading.hide();
            //Throw instead?
            alert(error);
        }

        //Is the object a function?
        function isFunction(obj) {
            return $.isFunction(obj);
        }

        //Is the object a string?
        function isString(obj) {
            return typeof obj == "string";
        }

        //Is the object an array?
        function isArray(obj) {
            return $.isArray(obj);
        }

        //Is the object a plain object
        function isPlainObject(obj) {
            return $.isPlainObject(obj);
        }

        //Format URL's
        function formatURL(url) {
            if (!url) return "";
            url = trimChars(url, "/#");
            url = url.replace("//", "/");
            return "/" + url;
        }

        //Run and return value if function, else return self
        //Used for properties that can be value or function
        function evalFunc(obj, e) {
            if (isFunction(obj)) return obj(e);
            else return obj;
        }
    }

    //Document ready, Initialize page here
    $(handleReady);

    return go;

} ());

//HTML Activator
Go.activator = (function () {

    var activator = {},
        config = Go.config(),
        clickHold;

    /***** Public *****/

    activator.run = function (html) {

        //Scroll
        //TODO: Need to cross-browser test this
        if (typeof scrollTo === "function") {
            $("[go-scroll]", html).each(function () {
                window.scrollTo($(this).offset().top);
            });
        }

        //Link click
        $(config.autoActivateViews ? "a:not([href=#],[href^=#],[href^=javascript],[href^=mailto],[go-deactivate])" : "a:[go-activate]", html).each(function () {
            //Get link
            var link = $(this);
            var url = link.attr("href");
            if (!url || url == "#") return;
            //Ensure isn't external link
            var base = window.location.protocol + "//" + window.location.hostname;
            if (url && url != "" && url.charAt(0) != "/" && base != url.slice(0, base.length)) {
                //Open all external links in new windows
                link.attr("target", "_blank");
                return;
            }
            //Remove any existing click events
            link.unbind("click");
            //Modify links to include hash
            if (config.autoCorrectLinks && url != undefined && url[0] == "/") {
                url = "#" + url.substr(1);
                link.attr("href", url);
            }
            //Don't attach event if link opens in new window
            if (link.attr("target") == "_blank") return;
            //Click
            link.click(function (clickEvent) {
                //Prevent default
                clickEvent.preventDefault();
                //Prevent duplicate requests
                if (preventDoubleClick()) return false;
                //Modify link
                if (url && url[0] == "#") url = "/" + url.substr(1);
                //Create ActionEvent object
                var e = new ActionEvent({
                    url: url,
                    sender: link,
                    clickEvent: clickEvent
                });
                //Run action
                Go.run(e);
                return false;
            });
        });

        //Form submit
        $(config.autoActivateViews ? "form:not([go-deactivate])" : "form:[go-activate]", html).submit(function (submitEvent) {
            //Prevent duplicate requests
            if (preventDoubleClick()) return false;
            //Locals
            var form = $(this),                 //Get form
                e = new ActionEvent({           //Create ActionEvent object
                    url: form.attr("action"),
                    sender: form,
                    isPost: true,
                    submitEvent: submitEvent
                });
            //Return if no ajax
            if (form.attr("data-ajax") == "false" || form.find(":submit").attr("data-ajax") == "false") return;
            //Prevent default
            submitEvent.preventDefault();
            //Ensure unique ids
            form.attr("id", Go.utils.createRandomId());
            //Convert fields to array, exclude filtered items
            //Array is in format [{name: "...", value: ".."},{name: "...", value: "..."}]
            //TODO: serializeArray does not always work... need to investigate
            e.postData = form.find(":input").not(config.submitFilter).serializeArray();
            //Disable form
            Go.utils.toggleSender(form, false);
            //Run action
            Go.run(e);
            return false;
        });

        //Submit button click
        $(config.autoActivateViews ? ":submit:not([go-deactivate])" : ":submit[go-activate]", html).click(function (e) {
            //Prevent default
            e.preventDefault();
            var form = $(this).parents("form:first");
            //Return if no ajax
            if (form.attr("data-ajax") == "false") return;
            //Submit form
            form.submit();
            return false;
        });

        //Run attribute click
        $("[go-run]", html).click(function (clickEvent) {
            //Prevent duplicate requests
            //TODO: This does not allow radio/checks for some reason
            //if (preventDoubleClick()) return false;
            //Create event object
            var el = $(this),                   //Get clicked element
                e = new ActionEvent({           //Create ActionEvent object
                    url: el.attr("go-run"),
                    sender: el,
                    clickEvent: clickEvent
                });
            //Run action
            Go.run(e);
        });

        //Close
        $("[go-close]", html).click(function () {
            $(this).closest("[go-update]").remove();
        });

        //Submit on dropdown change
        $("select[go-submit]", html).change(function () {
            $(this).parent("form:first").submit();
        });

        //Submit on click
        $("[go-submit]:not(select)", html).click(function () {
            $(this).parent("form:first").submit();
        });

        //Autoset focus
        var el = $("[go-focus]", html);
        if (el.length > 0) setTimeout(function () { el.first().focus(); }, 100);
        else setTimeout(function () { $(":input:first:not([go-focus=false])", html).focus(); }, 100);

    };

    return activator;

    /***** Private *****/

    //Prevent a double click for .7 seconds
    //Prevents user from making duplicate requests
    //TODO: Add time to config
    function preventDoubleClick() {
        if (clickHold != undefined) return true;
        else {
            clickHold = {};
            setTimeout(function () { clickHold = undefined; }, 700);
        }
        return false;
    }

} ());

//Template Renderer
Go.templates = (function () {

    var templates = {};

    /****** Public ******/

    //Render template with data
    templates.render = function (name, data) {
        if (data === null || data === undefined) data = {};
        var func = templateCache[name];
        if (!func) throw "Template is not stored";
        var item = { data: data, helpers: helpers };
        var parts = func.call(data, jQuery, item);
        var html = "";
        for (var i = 0; i < parts.length; i++) html += parts[i];
        return html;
    };

    //Render individual data item or an array of items
    templates.renderAll = function (name, data) {
        var html = "",
            renderFunc = Go.templates.render;
        if (jQuery.isArray(data))
            jQuery(data).each(function () {
                html += renderFunc(name, this);
            });
            else html += renderFunc(name, data);
        return html;
    };

    //Store template in cache
    templates.store = function (name, html) {
        if (!name || !html) throw "Empty HTML string passed";
        var html = $(html)[0].outerHTML;
        html = preformatHTML(html);
        //TODO: Optionally store templates in local storage
        html = convertShortcuts(html);
        var func = createFunction(html);
        templateCache[name] = func;
    };

    //Add a helper for rendering
    templates.addHelper = function (name, helper) {
        helpers[name] = helper;
    };

    //Encode HTML
    templates.encode = function (html) {
        // Do HTML encoding replacing < > & and ' and " by corresponding entities.
        return ("" + html).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
    };

    /****** Private ******/

    //Fields
    var templateCache = {}, helpers = {};

    //Remove comments and whitespace
    function preformatHTML(html) {

        html = html
            .replace(/[ ]{2,}/g, "")        //Remove multiple spaces
            .replace(/<!--(.*?)-->/g, "")   //Replace comments
			.replace(/([\\'])/g, "\\$1")    //Replace values with token
			.replace(/[\r\t\n]/g, " ")      //Replace line endings to spaces
            .replace(/{&gt; /g, "{> ");     //Replace {&gt; with {> (for children)

        return trim(html);
    }

    //Convert shortcuts to pure template markup
    function convertShortcuts(html) {

        //Get root
        var root = $("<div>" + html + "</div>");

        //any attributes
        root.find("[go-any]").each(function () {
            var el = $(this);
            var val = el.attr("go-any");
            $(this).before("{? " + val || "this" + "}").after("{/?}").removeAttr("go-any");
        });

        //none attributes
        root.find("[go-none]").each(function () {
            var el = $(this);
            var val = el.attr("go-none");
            if (!val) val = "this";
            $(this).before("{? !" + val + "}").after("{/?}").removeAttr("go-none");
        });

        //if attributes
        root.find("[go-if]").each(function () {
            var el = $(this);
            var val = convertConditionExpr(el.attr("go-if"));
            el.before("{? " + val + "}").after("{/?}").removeAttr("go-if");
        });

        //each attributes
        root.find("[go-each]").each(function () {
            var el = $(this);
            var val = el.attr("go-each");
            if (!val) val = "this";
            el.before("{~ " + val + "}").after("{/~}").removeAttr("go-each");
        });

        //Get HTML with markup
        html = root.html();

        //Remove host from href attributes
        //JQuery auto-inserts these values
        var base = location.protocol + "//" + location.host + "/";
        var regex = new RegExp("href=[\"|']" + base, "g");
        html = html.replace(regex, "href=\"");

        //Regex Replacements
        html = html
			.replace(/[\r\t\n]/g, " ") //Replace line endings to spaces
            .replace(/{&gt; /g, "{> ") //Replace {&gt; with {> (for children)
            .replace(/%7B#/g, "{#") //Replace %7B# with {#
            .replace(/\{\?\}/g, "{? this}") //Replace {?} with {? this}
            .replace(/\{\~\}/g, "{~ this}") //Replace {~} with {~ this}
            .replace(/\{\.\}/g, "{= this}") //Replace {.} with {this}
            .replace(/\{(([^\/\*\?\$\^\*\.\+\-\!@%&~#:>=]{1})([^{}]*))\}/g, "{= $1}"); //Replace {expression} with {= expression}

        return html;
    }

    //Create a reusable function from template text
    function createFunction(html) {

        var TAG_REGEX = /\{(\/?)([\*\?\$\^\*\.\+\-\!@%&~#:>=]\w*)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}/g;

        //Replace tags with code
        var code = html.replace(TAG_REGEX, convertTagToCode);

        //Create final function string
        //Introduce the data as local variables using with(){}
        var funcStr = "var $=jQuery,call,__=[],$data=$item.data;with($data){__.push('" + code + "');}return __;";

        //Convert to function
        return new Function("jQuery", "$item", funcStr);
    }

    //Convert each tag {?} to javascript code
    function convertTagToCode(all, slash, type, fnargs, target, parents, args) {

        //Decode HTML
        target = decodeHTML(target);

        //Child templates
        if (type == ">") {
            var args = target.split(","),
                tempName = quote(args[0]),
                data = (args.length > 1 && args[1]) ? trim(args[1]) : "this";
            return format("');__.push(Go.templates.renderAll({0},(typeof({1})!=='undefined')?{1}:this));__.push('", tempName, data);
        }

        //Helpers
        if (/^#/.test(type)) {
            //Get helper function
            type = type.replace(/^#/, "");
            var helper = helpers[type];
            if (!helper) throw "Helper does not exist";
            //Arguments
            var args = "", items = target.split(",");
            $(items).each(function () {
                args += quote(this) + ",";
            });
            args = args.replace(/^,+|,+$/g, '');
            //Call helper with arguments
            return format("');__.push($item.helpers['{0}'].call(this,[{1}]));__.push('", type, args);
        }

        //Template tags
        var tags = {
            "~": {
                _default: { $2: "index, value" },
                open: "if($notnull_1){$.each($1a,function($2){with(this){",
                close: "}});}"
            },
            "?": {
                open: "if(($notnull_1) && $1a){",
                close: "}"
            },
            ":": {
                _default: { $1: "true" },
                open: "}else if(($notnull_1) && $1a){"
            },
            "%": {
                // Unencoded expression evaluation.
                open: "if($notnull_1){__.push($1a);}"
            },
            "=": {
                // Encoded expression evaluation. Abbreviated form is ${}.
                _default: { $1: "$data" },
                open: "if($notnull_1){__.push(Go.templates.encode($1a));}"
            },
            "!": {
                // Comment tag. Skipped by parser
                open: ""
            }
        };

        //Convert tag
        var tag = tags[type], def, expr, exprAutoFnDetect;
        if (!tag) {
            throw "Unknown template tag: " + type;
        }
        def = tag._default || [];

        if (target) {
            target = unescape(target);
            args = args ? ("," + unescape(args) + ")") : (parents ? ")" : "");
            // Support for target being things like a.toLowerCase();
            // In that case don't call with template item as 'this' pointer. Just evaluate...
            expr = parents ? (target.indexOf(".") > -1 ? target + unescape(parents) : ("(" + target + ").call(this" + args)) : target;
            exprAutoFnDetect = parents ? expr : "(typeof(" + target + ")==='function'?(" + target + ").call(this):(" + target + "))";
        } else {
            exprAutoFnDetect = expr = def.$1 || "null";
        }
        fnargs = unescape(fnargs);
        var code = "');" +
			tag[slash ? "close" : "open"]
				.split("$notnull_1").join(target ? "typeof(" + target + ")!=='undefined' && (" + target + ")!=null" : "true")
				.split("$1a").join(exprAutoFnDetect)
				.split("$1").join(expr)
				.split("$2").join(fnargs || def.$2 || "") +
			"__.push('";

        return code;
    }

    //Convert expressions (=, ^=, *=, !=, ~=) to javascript 
    function convertConditionExpr(expr) {
        return expr.replace(/([^=])={1}([^=]*)/g, "$1==\"$2\"");
        //TODO: Add other comparers ^=, *=, $=, !=, ~=, requires change to tag regex
        //.replace(/([^=\^]+)\^{1}={1}([^=\^]+)/g, "(new RegExp(\"^$2\",\"g\")).test($1)")
    }

    //Helpers

    function trim(str) {
        return jQuery.trim(str);
    }

    function format(str, vals) {
        vals = typeof vals === 'object' ? vals : Array.prototype.slice.call(arguments, 1);
        return str.replace(/\{\{|\}\}|\{(\w+)\}/g, function (m, n) {
            if (m == "{{") { return "{"; }
            if (m == "}}") { return "}"; }
            return vals[n];
        });
    };

    function quote(str) {
        str = str.replace(/^["' ]+|["' ]+$/g, '');
        return "'" + str + "'";
    }

    function decodeHTML(text) {
        if (text == undefined || text == null) return text;
        return $("<div/>").html(text).text();
    }

    function unescape(args) {
        return args ? args.replace(/\\'/g, "'").replace(/\\\\/g, "\\") : null;
    }

    return templates;

} ());

//Loading Indicator
Go.loading = (function () {

    var loadingHTML,
        config = Go.config(),
        isShown;

    return {

        show: function () {
            
            //Ensure indicator exists
            if (!loadingHTML) {
                loadingHTML = $(
                    "<div id='loading-indicator' title='Loading' class='" + config.loadingIndicatorCSS + "'></div>"
                ).appendTo("body")
                .hide();
            }

            //Exit if already shown are about to open
            if (isShown) return;

            //Show indicator
            showIndicator();
            isShown = true;

            //Adjust position on window scroll or resize
            $(window).bind("scroll._loading", showIndicator);
            $(window).bind("resize._loading", showIndicator);

        },

        hide: function () {
            
            //Hide
            loadingHTML.hide();
            isShown = false;

            //Unbind events
            $(window).unbind("scroll._loading");
            $(window).unbind("resize._loading");

        }

    };

    //Show indicator
    function showIndicator() {

        //Show in center of window
        loadingHTML.css({
            position: "absolute",
            top: Math.max(0, (($(window).height() - loadingHTML.outerHeight()) / 2) + $(window).scrollTop()) + "px",
            left: Math.max(0, (($(window).width() - loadingHTML.outerWidth()) / 2) + $(window).scrollLeft()) + "px"
        }).show();

        //Hide after 15 secs
        setTimeout(function () {
            loadingHTML.hide();
        }, 15000);

    }

} ());

//Utilities
Go.utils = {

    //Create a random id
    createRandomId: function () {
        return Math.random().toString().replace(".", "");
    },

    //Disable/Enable sender
    toggleSender: function (sender, enabled) {
        //Form
        if ($(sender).is("form")) {
            if (enabled) sender.find("input,textarea,select,button").removeAttr("disabled", "disabled");
            else sender.find("input,textarea,select,button,:password").attr("disabled", "disabled");
        }
        //TODO: Disable other sender types
    }

};


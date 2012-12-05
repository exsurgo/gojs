
/*
*   GoJS 0.7.9.4
*   Dependencies: jQuery 1.5+
*
*   GoJS is a full-featured MVC framework that provides support for controllers, actions, views, models, routing,
*   deep linking, back/front button support, loading indication, resource loading, template rendering, and storage.
*
*   (c) 2012 Sterling Nichols
*   Distributed under the MIT license.
*   For all details and documentation:
*   http://exsurgo.github.com/gojs
*/


/***** Public objects *****/

// Controller
var Controller = function (ctrlName, items) {
    return this.construct(ctrlName, items);
};

// Action
var Action = function (props) {
    return this.construct(props);
};

// ActionEvent
var ActionEvent = function (props) {
    return this.construct(props);
};


/***** Core *****/

var Go = (function () {

    var go = {};


    /***** Init *****/

    // Private fields
    var _controllers = {},      // Controllers
        _updaters = {},         // Custom update functions
        _events = [],           // Global events
        _content,               // Main content area
        _componentFields = {};  // Fields for components to share


    // Default config
    var _config = {
        //Routes
        routes: [], //TODO: Move this to its own field
        //Settings
        autoActivateViews: true,                    // Automatically activate every link and form
        autoCorrectLinks: true,                     // Change standard URL's to ajax (#) URL's
        contentSelector: "[go-content]",            // The main content area
        defaultContentUrl: null,                    // URL to request if content area is empty on page load
        submitFilter: null,                         // Don't submit any form elements that match this
        loadingIndicatorCSS: "loading-indicator",   // CSS style for the loading indicator
        prefixControllerNameToViews: true,          // If true append the controller name to view keys
        runOnPageLoad: false,                       // Run the default action for "/" on page load
        //Resource Routes
        scriptRoute: "/scripts/{key}.js",
        styleRoute: "/styles/{key}.css",
        viewRoute: "/views/{key}.html",
        controllerRoute: "/controllers/{key}.js",
        modelRoute: "/models/{key}.js"
    };

    // Properties
    go.isRequesting = false;    // Is making a request
    go.wait = false;            // Hold all actions from running

    /***** Public Methods *****/

    // Run Action
    go.run = function () {

        //Arguments, overloaded
        var args = arguments,
            a1 = args[0],
            a2 = args[1],
            a3 = args[2];

        //Argument is string, assume is URL
        if (args.length == 1 && isString(a1)) handleRun(new ActionEvent({ url: a1 }));

        //Argument is an ActionEvent
        else if (a1 instanceof ActionEvent) handleRun(a1);

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

    // Get
    go.get = function (url, callback) {
        go.request({ url: url, response: callback });
    };

    // Post
    go.post = function (url, data, callback) {
        go.request(url, {
            isPost: true,
            postData: data,
            response: callback
        });
    };

    // Request 
    go.request = function (url, options) {
        handleRequest(url, options);
    };

    // Reload
    go.reload = function (redirect, enableSSL) {
        //Locals
        var protocol = location.protocol,
            host = location.host;
        //Show progress
        go.showLoading();
        //Hold any requests
        go.wait = go.formatURL(redirect);
        //If protocol is changing, change entire href
        if ((protocol == "http" && enableSSL) || (protocol == "https" && !enableSSL)) {
            location.href = "http" + (enableSSL ? "s" : "") + "://" + host + "#" + newHash;
        }
        //Else change hash and reload
        {
            //Must use $location.hash, not $hash
            location.hash = go.wait;
            location.reload();
        }
    };

    // Get/Set config
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

    // Set routes
    go.route = function (routes) {
        _config.routes = _config.routes.concat(routes);
    };

    // Add event
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

    // Run update
    go.update = function (updater, element) {
        handleUpdate(new ActionEvent({
            updater: updater,
            element: element
        }));
    };

    // Add updaters
    go.addUpdaters = function (updaters) {
        _updaters = extend(_updaters, updaters);
    };

    // Add component
    go.module = function (func) {
        func.call(null, go, jQuery, _componentFields);
    }


    /***** Constructors *****/

    //Construct objects internally for access to private functions

    Controller.prototype.construct = function (ctrlName, items) {

        // Create controller object
        var ctrl = {
            name: ctrlName,
            //Hash object to store actions
            actions: {}
        };

        // Add each item to controller
        for (var key in items) {

            var action = items[key],
                isActionObj = action instanceof Action;

            // Actions
            if (isActionObj || isFunction(action)) {

                // Only for Action objects
                if (isActionObj) {

                    // Add properties
                    extend(action, {
                        controller: ctrl,
                        name: key
                    });

                    // Add action specific routes
                    // Important, add action routes at beginning of collection so other routes are overridden
                    // TODO: Need separate collection for action routes
                    // TODO: Add support for multiple routes?
                    var route = action.route;
                    if (route) {
                        // String
                        if (isString(route)) _config.routes.unshift({ route: route, defaults: { controller: ctrlName, action: key } });
                        // Object
                        else _config.routes.unshift(route);
                    }
                }

                // Add action to controller "actions" collection
                ctrl.actions[key] = action;

            }

            // Todo: add support for controller specific routes

            // Else just add item to controller
            // Normally, functions would be added as helpers in this case
            else ctrl[key] = item;

        };

        // Shortcut Methods
        // Allows for MyController.list(values) rather than Go.run("MyController", "list", values)
        // For functions, can use arguments... MyController.list(arg1, arg2)
        // Important! Must use separate function for key to resolve correctly
        for (var key in ctrl.actions) addShortcut(ctrl, key);
        function addShortcut(ctrl, actionName) {
            // Only add if controller property name does not already exist
            if (!ctrl[actionName]) {
                // Get action from "actions" collection
                var action = ctrl.actions[actionName];
                // If function, pass in arguments and use empty ActionEvent as context
                if (isFunction(action)) {
                    ctrl[actionName] = function () {
                        action.apply(new ActionEvent({}), arguments);
                    };
                }
                // Else if Action object, use Go.run() method
                else {
                    ctrl[actionName] = function (values) {
                        go.run(ctrl.name, actionName, values);
                    };
                }
            }
        }

        // Add controller to global collection
        _controllers[ctrlName] = ctrl;

        // Return controller for chaining
        return ctrl;

    };

    Action.prototype.construct = function (options) {
        return extend(this, options);
    };

    ActionEvent.prototype.construct = function (options) {
        if (!options.values) options.values = {};
        return extend(this, options);
    };


    /***** Handlers *****/

    function handleReady(e) {

        //Find and cache content area
        _content = $(_config.contentSelector);

        //Create ActionEvent object
        //URL is either current hash or "/" by default
        var e = new ActionEvent({
            element: $("body"),
            url: go.formatURL(location.hash) || "/"
        });
        getRouteValuesFromUrl(e);

        //EVENT: ready
        triggerEvents("ready", e);

        //Activate entire document
        runNextHandler(handleActivate, e);

        //Handle initial hash value
        requireAll(e, function () {
            if (e.url == "/" && !_config.runOnPageLoad) return;
            //Empty content area
            _content.empty();
            //Don't start if url is held
            if (go.wait == e.url) go.wait = null;
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
            e.url = go.formatURL(e.url);

            //Get route values
            getRouteValuesFromUrl(e);

        };

        //EVENT: beforeRun
        triggerEvents("beforeRun", e);

        //Load all resources
        requireAll(e, function () {

            //Locate action
            if (e.action || tryLocateAction(e)) {

                var action = e.action;

                //EVENT: run
                triggerEvents("run", e);

                //Load all resources
                requireAll(e, function () {

                    //If "action.remote" then make request
                    //Assume all other actions are local otherwise
                    //TODO: Add global config to set all remote
                    if (action.remote) runNextHandler(handleRequest, e);

                    //Else if has view, the render
                    else if (action.view) runNextHandler(handleRender, e);

                    // If action is function, run here
                    // If triggered by route, then e is passed as arg
                    else if (isFunction(e.action)) {
                        e.action.call(e, e);
                        runNextHandler(handleComplete, e);
                    }

                    //Else complete
                    else runNextHandler(handleComplete, e);

                });

            }

            //Show error if unable to location action
            //Each activated link must have a controller action
            else if (!e.action) throw "Could not locate action for URL \"" + e.url + "\"";

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

        //Resolve remote URL
        var remoteURL = isFunction(remote) ? remote(e) : //Run if function
                        isString(remote) ? remote : //Use self if string
                        e.url; //Use URL if anything else

        //Merge URL with values
        remoteURL = e.remote = Go.format(remoteURL, e.values);

        //Confirm request
        if (!confirmAction(e.sender)) return false;

        //Show loading indicator
        go.showLoading();

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
        go.enable(e.sender, true);

        //EVENT: requestError
        triggerEvents("requestError", e);

        //Hide progress
        go.hideLoading();

        //Signify request is complete
        go.isRequesting = false;

    }

    function handleResponse(e) {

        // Locals
        var contentType = (e.xhr.getResponseHeader("content-type") || "").toLowerCase(),
            data = e.data,
            isHTML = (/html/i).test(contentType),
            isJSON = (/json/i).test(contentType);

        // Update properties
        extend(e, {
            contentType: contentType,
            isHTML: isHTML,
            isJSON: isJSON
        });

        // Some other response type, Check for JSON
        // Attempt to parse, continue on exception
        if (!isHTML && !isJSON) {
            try {
                data = $.parseJSON(data);
                isJSON = true;
            } catch (e) { }
        }

        // EVENT: response
        triggerEvents("response", e);

        // Hide progress
        go.hideLoading();

        // Signify request is complete
        go.isRequesting = false;

        // Error(s) found, indicated by "error" or "errors" properties
        if (isJSON && data && (data.error || data.errors)) runNextHandler(handleError, e);

        // Success
        else runNextHandler(handleSuccess, e);
    }

    function handleSuccess(e) {

        // EVENT: success
        triggerEvents("success", e);

        // Next handler

        // Update if HTML and has updater
        // TODO: Is this needed, Should HTML be requested at all here?
        if (e.isHTML && e.updater) runNextHandler(handleUpdate, e);

        // Render if view is specified
        else if (Go.getProp("action.view", e)) runNextHandler(handleRender, e);

        //Else handle complete
        else runNextHandler(handleComplete, e);
    }

    function handleError(e) {

        //Add error(s) props to "e" for easy access
        extend(e, e.data, "error,errors");

        // Enable sender
        go.enable(e.sender, true);

        //EVENT: error
        triggerEvents("error", e);

    }

    function handleRender(e) {

        // Locals
        var action = e.action,
            view = action.view;

        // If no view, then goto complete
        if (!view) {
            runNextHandler(handleComplete, e);
            return;
        }

        // Prefix controller name to view
        // TODO: Need a better way to do this
        if (_config.prefixControllerNameToViews && !/\//.test(view))
            view = e.values.controller + "/" + view;

        // Replace any params with values
        view = go.format(view, e.values);

        // Ensure view is loaded
        go.require({ views: view }, function () {

            //Get model
            var model = resolveModel(e);

            // Render the template if model is provided
            // Pass event object internally as 3rd param
            // TODO: Should template be rendered if no model? Then view property can't be used in some cases
            e.element = go.render(view, model, /* internal */ e);

            // EVENT: render
            triggerEvents("render", e);

            // Update the rendered element
            runNextHandler(handleUpdate, e);

        });

    }

    function handleUpdate(e) {

        // Locals
        var action = e.action,
            element = $(e.element),
            id = element.attr("id"),
            updater = e.updater,
            updateData = isPlainObject(updater) ? updater : {},
            target;

        // Get updater name
        // Can be string, or object with "name" property
        var updaterName = (isString(e.updater) ? e.updater : e.updater.type).toLowerCase();

        // Ensure "updater" property is provided
        if (!updaterName) {
            runNextHandler(handleComplete, e);
            return;
        }

        // Ensure element has id
        if (!id) {
            id = go.createRandomId();
            element.attr("id", id);
        }

        // Add properties to event object
        extend(e, {
            updateData: updateData,
            updateId: id,
            element: element
        });

        // EVENT: updating
        triggerEvents("updating", e);

        // Hide update
        element.hide();

        // Check custom updaters
        var isUpdated = false;
        for (var item in _updaters) {
            if (item.toLowerCase() == updaterName) {
                // Run custom updater
                _updaters[item](e);
                isUpdated = true;
                continue;
            }
        }

        // Check standard updates
        // content, replace, insert, append, prepend, after, before
        if (!isUpdated) {

            // Content 
            if (updaterName == "content") {
                // TODO: Move address/title to complete?
                // Address
                go.setAddress(e.address || e.url);
                // Page Title
                var title = evalFunc(e.title, e);
                if (title) document.title = title;
                // Content
                $(_config.contentSelector).empty().append(element);
                // Scroll to top by default
                if (!updateData.scroll && isFunction(scrollTo)) $(window).scrollTop(0);
            }

            // Other Updaters
            else {

                // Try to get existing version of element
                var existing = $("#" + id);

                // Replace
                if (updaterName == "replace" || existing.length) existing.replaceWith(element);

                // Targeted updates
                else {

                    // Try to get from string via pattern "{updater}: selector"
                    if (/:/.test(updaterName)) {
                        var i = updaterName.indexOf(":");
                        target = updaterName.slice(i + 1);
                        updaterName = updaterName.slice(0, i);
                    }

                    // Try to get from object
                    else target = updaterData.target;

                    // Merge with values
                    target = go.format(target, e.values);

                    // Require target
                    if (!target) throw "Element \"" + id + "\" with update \"" + updaterName + "\" requires a target";

                    // Convert to jQuery
                    target = $(target);

                    if (updaterName == "insert") target.html(element);
                    if (updaterName == "prepend") target.prepend(element);
                    if (updaterName == "append") target.append(element);
                    if (updaterName == "before") target.before(element);
                    if (updaterName == "after") target.after(element);

                }

            }

        }

        // EVENT: updated
        triggerEvents("updated", e);

        // Show update
        element.show();

        // Activate the view
        runNextHandler(handleActivate, e);

    }

    function handleActivate(e) {

        // Locals
        var element = e.element;

        // EVENT: activate
        triggerEvents("activate", e);

        // Run activator
        go.activate(element);

        // Run complete handler
        runNextHandler(handleComplete, e);

    }

    function handleComplete(e) {

        // Enable sender
        go.enable(e.sender, true);

        // EVENT: complete
        triggerEvents("complete", e);

        // Redirect
        var redirect = getActionValue("redirect", e);
        if (redirect) Go.run(redirect);

        // Remove
        var remove = getActionValue("remove", e);
        if (remove) $(remove).remove();

        // Empty
        var empty = getActionValue("empty", e);
        if (empty) $(empty).empty();

        // Show
        var show = getActionValue("show", e);
        if (show) $(show).show();

        // Hide
        var hide = getActionValue("hide", e);
        if (hide) $(hide).hide();

        // Focus
        var focus = getActionValue("focus", e);
        if (focus) $(focus).focus();
    }


    /***** Private Methods *****/

    // Get route values from URL
    // Adds values to e, return true if found
    // TODO: Return route object instead?
    function getRouteValuesFromUrl(e) {

        //Prevent from running twice
        if (e.routeMatched != undefined) return e.routeMatched;

        //Ensure values is initialized
        e.values = (e.values || {});

        //Locals
        var url = go.trimChars(e.url, "/"),
            routes = _config.routes,
            length = routes.length;

        //Query string
        if (/\?/.test(url)) {

            //Split string from path
            var parts = url.split("?");
                params = parts[1].split("&");

            //Reassign URL path
            url = go.trimChars(parts[0], "/");

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
                route = go.trimChars(routeObj.route, "/") || "/",
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
                    go.trimChars(paramNames, "{}");

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

    // Try to locate a controller and action
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

    // Resolve model from property and response
    function resolveModel(e) {

        //Locals
        var model,
            modelType = e.action.model,
            data = e.data || null;

        //Model is function, execute with e as this, and response data as argument 
        if (isFunction(modelType)) model = modelType.call(e, e.data);

        //Model is object, combine
        else if (typeof modelType == "object") model = extend(data, modelType);

        //Model is null or undefined, just use data
        else if (!modelType) model = data;

        //Assign resolved model
        if (model) e.model = model;

        return model;
    }

    // Trigger events on e, controller or action
    // Trigger events added by "on" method
    function triggerEvents(eventType, e) {

        //Context, try to get controller
        //Use window if controller not available
        var values = e.values,
            controller = (e.controller || //Try first
                            e.values ? findPropIgnoreCase(_controllers, e.values.controller) : false || //Try to resolve if not exists
                            window); //Else, just use window

        //Match event by lowercase
        eventType = eventType.toLowerCase();

        //Try to run global events added by "on" method
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

        //Try to run event on ActionEvent "e" object
        callFunction(e, eventType, e, e);

        //Try to run event on Action "action" object
        callFunction(e, "action." + eventType, e, e);

    }

    // Run the next step, can be canceled or delayed
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

    // Load all required resources for an event
    // Load required on event, controller and action
    function requireAll(e, callback) {
        //e.require
        go.require(e.require, function () {
            //e.controller.require
            go.require(Go.getProp("controller.require", e), function () {
                //e.action.require
                go.require(Go.getProp("action.require", e), function () {
                    callback();
                });
            });
        });
    }


    /***** Private Helpers *****/

    // Confirm
    // Use go-confirm, go-confirm="{verb}", or go-confirm="{message}"
    // TODO: Add default message to config
    // TODO: Remove this from core framework
    function confirmAction(sender) {
        if (isFunction(confirm) && sender) {
            if (sender.is("[go-confirm]")) {
                var val = sender.attr("go-confirm");
                // Single word, assume is a verb
                if (val.indexOf(" ") == -1) return confirm("Are you sure you want to " + val + "?");
                // Assume is a full statement
                else if (val.indexOf(" ") > -1) return confirm(val);
                // No value, use generic confirm
                else return confirm("Are you sure you want to do this?");
            }
        }
        return true;
    }

    // Call a global or namespaced function by string
    // Returns true if the function was called
    function callFunction(obj, name, context, args) {
        var func = go.getProp(name, obj);
        //If value is string, try to resolve to fuction
        if (isString(func)) func = go.getProp(func, window);
        //If value is function, then run
        if (isFunction(func)) {
            func.call(context, args);
            return true;
        }
    }

    // Get the N argument of a certain type
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

    // Find first property on object ignoring case
    function findPropIgnoreCase(obj, propName) {
        if (!propName) return;
        for (var key in obj) {
            if (key.toLowerCase() == propName.toLowerCase()) return obj[key];
        }
    }

    // Extend one object with another
    // Props is a comma delimited whitelist
    function extend(obj1, obj2, props) {
        if (props) {
            $(props.split(",")).each(function (i, val) {
                if (obj2[val]) obj1[val] = obj2[val];
            });
        }
        else return $.extend(obj1, obj2);
    }

    // Is the object a function?
    function isFunction(obj) {
        return $.isFunction(obj);
    }

    // Is the object a string?
    function isString(obj) {
        return typeof obj == "string";
    }

    // Is the object an array?
    function isArray(obj) {
        return $.isArray(obj);
    }

    // Is the object a plain object
    function isPlainObject(obj) {
        return $.isPlainObject(obj);
    }

    // Run and return value if function, else return self
    // Used for properties that can be value or function
    function evalFunc(obj, e) {
        if (isFunction(obj)) return obj(e);
        else return obj;
    }

    // Get an action propert value and merge with values
    function getActionValue(action, e) {
        var prop = go.getProp("action." + action, e);
        if (prop) {
            prop = go.format(prop, e.values);
            prop = go.format(prop, e);
        }
        return prop;
    }

    /***** Public Utilities *****/

    // Create a random id
    go.createRandomId = function () {
        return "id" + Math.random().toString().replace(".", "");
    };

    // Format a string with values
    go.format = function (str, vals) {
        vals = $.isPlainObject(vals) ? vals : Array.prototype.slice.call($.isArray(vals) ? vals : arguments, 1);
        str = str.replace(/\{(\w+)\}/g, function (m, n) {
            var val = vals[n];
            if (val === null || val === undefined) return "";
            else return val;
        });
        return str;
    };

    // Disable/Enable element
    go.enable = function (element, enabled) {
        //Form
        element = $(element);
        // Enable/Disable form
        if (element.is("form")) {
            if (enabled) element.find("input,textarea,select,button").removeAttr("disabled", "disabled");
            else element.find("input,textarea,select,button,:password").attr("disabled", "disabled");
        }
        // TODO: Enable/Disable links
    };

    //Locate a property by name
    go.getProp = function (name, parent) {
        if (name) {
            parent = parent || window;
            $(name.split(".")).each(function () {
                if (parent) parent = parent[$.trim(this)];
            });
            return parent;
        }
    };

    //Create a property by name
    go.setProp = function (name, parent, value) {
        if (name) {
            parent = parent || window;
            if (value == undefined) value = {};
            // Create global or nested property
            var parts = name.split("."),
                len = parts.length;
            $(parts).each(function (i) {
                var key = $.trim(this);
                // Last item
                if (len == i + 1) parent[key] = value;
                // Else parent
                else {
                    var p = parent[key]
                    if (!isPlainObject(p) && !isArray(p)) parent[key] == {};
                    parent = parent[key];
                }
            });
            // Return value
            return value;
        }
    };

    // Encode HTML
    // TODO: Replace with jQuery function?
    go.encode = function (html) {
        // Do HTML encoding replacing < > & and ' and " by corresponding entities.
        return ("" + html).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
    };

    //Format URL's
    go.formatURL = function (url) {
        if (!url) return "";
        url = go.trimChars(url, "/#");
        url = url.replace("//", "/");
        return "/" + url;
    };

    // Trim multiple characters from end of string or array of strings
    go.trimChars = function (str, chars) {
        if (!str) return "";
        // Create regex to trim with
        // "{}" would produce "^{|{$|^}|}$"
        var regex = "";
        $(chars.split('')).each(function (index, value) {
            regex += "^" + value + "|" + value + "$|";
        });
        regex = new RegExp(regex, "ig");
        // Replace chars
        if ($.isArray(str))
            $(str).each(function (index, value) {
                str[index] = value.replace(regex, "");
            });
        else str = str.replace(regex, "");
        return str;
    };


    // Document ready, Initialize page here
    $(handleReady);

    return go;

})();


/***** Modules *****/

// Allows for a modular design
// Modules can be modified or removed in some cases

// Resource Loading
Go.module(function (go, $, fields) {

    // TODO: Add support for other resources such as images

    // fields
    var _loadedResources = {}   // All currently loading/loaded resources
    _config = go.config();  // Get config

    // Register all styles and scripts on page load
    // Prevents from loading again
    go.on("ready", function () {
        $("script[src]").each(function () { _loadedResources[$(this).attr("src")] = true; });
        $("link[href]").each(function () { _loadedResources[$(this).attr("href")] = true; });
    });

    // Require one or more resources
    go.require = function (require, callback) {

        //If require is null or undefined, just run callback
        if (!require) {
            callback();
            return;
        }

        //Evaluate if function
        require = typeof require == "function" ? require() : require;

        //Convert script or array to object
        //Assume they are scripts in this case
        if (typeof require === "string" || $.isArray(require))
            require = { scripts: require };

        //Locals
        var resources = [],
            callback = callback || function () {};

        //Check for child dependencies
        var child = require.require;
        if (child) go.require(child, function () {
            loadResources(require, callback);
        });

            //Else just get resources
        else loadResources(require, callback);

    };

    go.on("activate", function (e) {

        // Check for any views within views
        // Useful for re-rendering child elements
        e.element.find("[go-view]").each(function () {

            // Store and compile view
            // Key is go-view attribute
            var key = $(this).attr("go-view");
            go.storeView(key, this);

        });

    });

    // Loading helper
    function loadResources(require, callback) {

        // Locals
        var resources = [],
            total,
            callback = callback || function () { };

        // Add resources to single array
        $(getStringArray(require.scripts)).each(function () {
            resources.push({ key: this, script: true });
        });
        $(getStringArray(require.styles)).each(function () {
            resources.push({ key: this, style: true });
        });
        $(getStringArray(require.views)).each(function () {
            resources.push({ key: this, view: true });
        });
        $(getStringArray(require.models)).each(function () {
            resources.push({ key: this, model: true });
        });
        $(getStringArray(require.controllers)).each(function () {
            resources.push({ key: this, controller: true });
        });
        total = resources.length;

        // If no resources, just run callback
        if (total == 0) {
            callback();
            return;
        }

        // Check if all resources have been loaded
        // Then run callback if so
        var checkForCompletion = function () {
            total--;
            if (total == 0) {
                //Hide loading indicator
                go.hideLoading();
                //Run callback
                callback();
            }
        };

        // Show loading indicator
        go.showLoading();

        // Load each resource
        $(resources).each(function () {

            // Locals
            var resource = this,
                url = resource.key; //Assume key is the url

            //Combine with key with route config if local resource
            if (!(/^http:\/\/|^https:\/\//).test(url)) {
                var route = resource.script ? _config.scriptRoute :
                            resource.style ? _config.styleRoute :
                            resource.view ? _config.viewRoute :
                            resource.model ? _config.modelRoute :
                            resource.controller ? _config.controllerRoute :
                            undefined;
                if (route) url = route.replace("{key}", url).replace("//", "/");
            }

            // Ensure resource is only loaded once
            if (_loadedResources[url]) {
                checkForCompletion();
                return;
            };

            // Set as loaded now, can remove on error
            _loadedResources[url] = true;

            // Error callback, load failed
            var onError = function () {
                delete _loadedResources[url];
                throw "Resource \"" + url + "\" was not found.";
            };

            // Scripts and Styles
            // Add tag to head of page
            if (!resource.view) {

                // Locals
                var el,
                    isStyle = resource.style,
                    isScript = !isStyle;

                // Create script/link element to add to DOM
                var el;
                if (isScript) {
                    el = $("<script><\/script>");
                    el.attr({ src: url, type: "text/javascript", async: "async" });
                }
                else {
                    el = $('<link\/>');
                    el.attr({ href: url, rel: "stylesheet" });
                }

                // Load event
                el.load(function () {

                    //Run callback if all have been loaded
                    checkForCompletion();

                });

                // Error event
                el.error(onError);

                // Show loading indicator
                go.showLoading();

                // Add element to head
                $('head')[0].appendChild(el[0]);

            }

            // View
            // This section must interact with the template engine
            // for storing, comiling and checking for existing views
            else if (resource.view) {

                // Ensure view is only loaded once
                if (go.loadedViews[resource.key]) {
                    checkForCompletion();
                    return;
                };

                // Load with Ajax
                $.ajax({
                    type: "get",
                    url: url,
                    error: onError,
                    success: function (response) {

                        // Multiple views can be returned in one request
                        // The key should be specified in this case by "go-view" attribute
                        $(response).each(function () {

                            // Locals
                            var el = $(this);

                            // View key is either the resource key 
                            // or the go-view attribute on the element
                            var viewId = (el.attr("go-view") || resource.key);

                            // Only store if item has HTML
                            // jQuery returns text nodes also
                            if (el.length && el[0].outerHTML) {

                                // Store and compile view
                                go.storeView(viewId, el);

                            }

                        });

                        // Run callback if all have been loaded
                        checkForCompletion();
                    }
                });

            }

        });

    };

    // Return an array of lowercase, trimmed strings
    // Items can be a single string, a comma delimited array, or an array
    function getStringArray(items) {
        // Return empty array if undefined or null
        if (!items) return [];
        // If string, split by commas
        if (typeof items === "string") items = items.split(",");
        // Trim and convert all to lowercase
        var length = items.length;
        for (var i = 0; i < length; i++) items[i] = $.trim(items[i].toString());
        return items;
    }

});

// HTML Activator
Go.module(function (go, $, fields) {

    // Config
    go.config({
        actionDelay: 700
    });
    
    // Public

    go.activate = function (html) {

        var config = go.config();

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
                if (preventAction()) return false;
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
        var formSelector = config.autoActivateViews ? "form:not([go-deactivate])" : "form:[go-activate]", form;
        if (html.is(formSelector)) form = html;
        else form = html.find(formSelector);
        form.submit(function (submitEvent) {
            //Prevent duplicate requests
            if (preventAction()) return false;
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
            form.attr("id", Go.createRandomId());
            //Convert fields to array, exclude filtered items
            //Array is in format [{name: "...", value: ".."},{name: "...", value: "..."}]
            //TODO: serializeArray does not always work... need to investigate
            e.postData = form.find(":input").not(config.submitFilter).serializeArray();
            //Disable form
            Go.enable(form, false);
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

        //Run action on event
        runAction("run", "click", html);
        runAction("click", "click", html);
        runAction("dblclick", "dblclick", html);

        //Submit on dropdown change
        $("select[go-submit]", html).change(function () {
            $(this).parent("form:first").submit();
        });

        //Close
        $("[go-close]", html).click(function () {
            html.remove();
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

    // Private

    // Prevent a double clics/submits
    // Helps prevent duplicate requests
    var prevent;
    function preventAction() {
        if (prevent) return true;
        else {
            prevent = 1;
            setTimeout(function () { prevent = 0; }, go.config().actionDelay);
        }
        return false;
    }

    // Attach an event to an element
    function runAction(attr, type, html) {

        $("[go-" + attr + "]", html).on(type, function (event) { 

            //Prevent duplicate requests
            //TODO: This does not allow radio/checks for some reason
            //if (preventAction()) return false;

            //Create event object
            var el = $(this),                  //Get clicked element
                e = new ActionEvent({           //Create ActionEvent object
                    url: el.attr("go-" + attr),
                    sender: el,
                    event: event
                });

            //Run action
            Go.run(e);

        });

    }

});

// Template Renderer
Go.module(function (go, $, fields) {

    //TODO: Cache templates in local/session storage
    //TODO: Add configs for delimiters and param names

    //Config
    go.config({
        useDoubleBrackets: false
    });

    // Fields
    var _viewCache = {},    // Stored compiled templates
        _helpers = [],          // Stored template helpers
        format = go.format;     // For compression

    /****** Public ******/

    // Loaded views
    go.loadedViews = {};

    // Render template with data
    go.render = function (name, data, e) {

        // Use empty object by default
        if (data === null || data === undefined) data = {};

        // Retrive cached template
        var func = _viewCache[name];
        if (!func) throw "Template " + name + " is not stored";

        // ActionEvent object might be passed internally as 3rd param
        // Pass in "e" and "values" for access within templates
        var e, values;
        if (arguments.length > 2) {
            e = arguments[2];
            values = e.values;
        }

        // Render template
        var parts = func.call(data, jQuery, _helpers, renderUtils, e, values);
        var html = "";
        for (var i = 0; i < parts.length; i++) html += parts[i];

        // Bind any data in final step
        return bindData(html, data);

    };

    // Render individual data item or an array of items
    go.renderAll = function (name, data) {
        var html = "";
        if (jQuery.isArray(data))
            jQuery(data).each(function () {
                html += Go.render(name, this);
            });
        else html += Go.render(name, data);
        return html;
    };

    // Store template in cache
    go.storeView = function (name, html) {
        if (!name || !html) throw "Empty HTML string passed";
        var html = $(html)[0].outerHTML;
        html = prepareHTML(html);
        var func = createFunction(html);
        _viewCache[name] = func;
        go.loadedViews[name] = true;
    };

    // Add a helper for rendering
    go.addHelper = function (name, helper) {
        _helpers[name] = helper;
    };


    /****** Private ******/

    // Prepare HTML for compilation
    // Clean up, compress, replace attributes and run prep regexes
    function prepareHTML(html) {

        // Clean
        html = html
            .replace(/[ ]{2,}/g, "")            // Remove multiple spaces
            .replace(/<!--(.|\s)*?-->/g, "")    // Replace comments
            .replace(/([\\'])/g, "\\$1")        // Replace values with token
            .replace(/[\r\t\n]/g, " ")          // Replace line endings to spaces
            .replace(/{&gt; /g, "{> ")          // Replace {&gt; with {> (for children)
            .replace(/\\{/g, "#lcb#")           // Replace left curly bracket break
            .replace(/\\}/g, "#rcb#");          // Replace right currly bracket break

        // Convert to jQuery
        html = $(html);

        // Convert attributes to markup
        convertAttrToMarkup(html, "go-any", "?");
        convertAttrToMarkup(html, "go-none", "!");
        convertAttrToMarkup(html, "go-if", "?");
        convertAttrToMarkup(html, "go-each", "~");
        convertAttrToMarkup(html, "go-with", "^");

        // Get HTML output
        html = html[0].outerHTML;

        // Remove host from href attributes
        // JQuery auto-inserts these values
        var base = location.protocol + "//" + location.host + "/";
        var regex = new RegExp("href=[\"|']" + base, "g");
        html = html.replace(regex, "href=\"");

        //Regex Replacements
        html = html
			.replace(/[\r\t\n]/g, " ")      // Replace line endings to spaces
            .replace(/{&gt; /g, "{> ")      // Replace {&gt; with {> (for children)
            .replace(/%7B#/g, "{#")         // Replace %7B# with {#
            .replace(/\{\?\}/g, "{? this}") // Replace {?} with {? this}
            .replace(/\{\~\}/g, "{~ this}") // Replace {~} with {~ this}
            .replace(/\{\.\}/g, "{= this}") // Replace {.} with {this}
            .replace(/\{(([^\/\*\?\$\^\*\.\+\-\!@%&~#:>=]{1})([^{}]*))\}/g, "{= $1}"); // Replace {expression} with {= expression}

        return html;
    }

    // Create a reusable function from template text
    function createFunction(html) {

        // Regex to match template tags
        // TODO: Finish double bracket option
        var tagRegex, useDouble = go.config().useDoubleBrackets;
        if (!useDouble) tagRegex = /\{(\/?)([\*\?\$\^\*\.\+\-\!@%&~#:>=]\w*)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}/g;

        // Replace tags with code
        var code = html.replace(tagRegex, convertTagToCode);

        // Replace curly brackets in content
        code = code
            .replace(/\\#lcb#/g, "{")      // Replace left curly bracket break
            .replace(/\\#rcb#/g, "}");     // Replace right currly bracket break

        // Create final function string
        // Introduce the data as local variables using with(){}
        var funcStr = "var __=[];with(this){__.push('" + code + "');}return __;";

        // Debug - Add line breaks
        //funcStr = funcStr.replace(/;/g, ";\r\n").replace(/\{/g, "{\r\n").replace(/\}/g, "}\r\n");

        // Convert to function
        return new Function("$", "$h", "$u", "e", "values", funcStr);
    }

    // Convert each tag {?} to javascript code
    function convertTagToCode(all, slash, type, fnargs, target, parents, args) {

        // Locals
        var target = decodeHTML(target),    // Decode target, jQuery encodes
            format = go.format;             // For compression

        // Replace single quotes
        if (target != undefined) target = target.replace(/\\'/g, "\'");

        // Combine target and parents
        // TODO: Probably should just eval expression
        // May need to remove fnargs, parents & args
        if (target && parents) target = target + parents;

        // Value, encoded and unencoded
        // Use try/catch since undefined vars in "with" clause throws exception
        if (type == "=" || type == "%") {
            var encode = (type == "=" ? "" : ",1");
            return format("');try{__.push($u.eval({0}{1}))}catch(e){};__.push('", target, encode);
        }

        // If or If Not
        if (type == "?" || type == "!") {
            var negation = (type == "!" ? "!" : "");
            // open tag
            if (!slash) return format("');if({1}$u.check({0})){__.push('", target, negation);
            //close tag
            else return "')};__.push('";
        };

        // Else
        if (type == ":") return "');}else{__.push('";

        // Else If Not
        if (type == ":?" || type == ":!") {
            var negation = (type == ":!" ? "!" : "");
            return format("');}else if({1}$u.check({0})){__.push('", target, negation);
        }

        // If Not
        if (type == "!") {
            // open tag
            if (!slash) return format("');if(!$u.check({0})){__.push('", target);
           //close tag
            else return "')};__.push('";
        };

        // Each
        if (type == "~") {
            // open tag
            if (!slash) return format("');if($u.check({0})){$.each($u.array({0}),function(index,value){with(this){__.push('", target);
            // close tag
            else return "');}});};__.push('";
        }

        // With
        if (type == "^") {
            // open tag
            if (!slash) return format("');$u.call({0},function(){__.push('", target);
            // close tag
            else return "');});__.push('";
        }

        // Raw Script
        if (type == "*" && target) {
            return format("');{0};__.push('", target);
        }

        // Child templates
        if (type == ">") {
            var args = target.split(","),
                tempName = quote(args[0]),
                data = (args.length > 1 && args[1]) ? trim(args[1]) : "this";
            return format("');__.push(Go.renderAll({0},(typeof({1})!=='undefined')?{1}:this));__.push('", tempName, data);
        }

        // Helpers
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

        else throw "Unknown template tag: " + type;
    }

    // Convert expressions (=, ^=, *=, !=, ~=) to javascript 
    function convertConditionExpr(expr) {
        return expr.replace(/([^=])={1}([^=]*)/g, "$1==\"$2\"");
        //TODO: Add other comparers ^=, *=, $=, !=, ~=, requires change to tag regex
        //.replace(/([^=\^]+)\^{1}={1}([^=\^]+)/g, "(new RegExp(\"^$2\",\"g\")).test($1)")
    }

    // Bind any data to html
    // Must be called once all rendering is complete
    // Useful for binding data to forms
    function bindData(html, data) {
        html = $(html);
        // Elements marked with go-bind
        findAndSelf(html, "[go-bind]", function (el) {
            //Bind forms
            el.find(":input").each(function () {
                var input = $(this),
                    name = input.attr("name"),
                    value = Go.getProp(name, data),
                    tagName = input[0].tagName;
                //Check for undefined specifically
                if (value != undefined) {
                    if (tagName == "INPUT") input.attr("value", value);
                    else if (tagName == "TEXTAREA") input.html(value);
                    //TODO: Bind to selects, radios, checkboxes
                }
            });
        });
        return html[0].outerHTML;
    }

    // Convert attributes to markup
    // Example: <div go-each>Test</div> --> {~}Test{/~}
    function convertAttrToMarkup(html, attr, tag) {
        findAndSelf(html, "[" + attr + "]", function (el) {
            var val = el.attr(attr) || "this";
            el.before("{" + tag + " " + val + "}").after("{/" + tag + "}").removeAttr(attr);
        });
    }

    // Find matching elements including the parent element in search
    function findAndSelf(html, selector, callback) {
        html.find(selector).add(html.filter(selector)).each(function () {
            callback.call(null, $(this));
        });
    }

    // Utility funtions to assist in the rendering processess
    // These are passed to the comiled template function
    var renderUtils = {

        // Check if content should be rendered depending on condition
        check: function (condition) {
            // No if empty array
            if ($.isArray && condition.length === 0) return false;
            // If function, then run
            else if (typeof condition === "function") return condition.call(condition);
            // Yes
            else return condition;
        },

        // Evalutes an expression to a string value
        // raw param sets HTML encoding to one of off
        eval: function (value, raw) {
            if (value === null || value === undefined) return "";
            if (typeof value === "function") return value.call(value);
            else return raw ? value.toString() : Go.encode(value);
        },

        // Run a function with a new context
        // Allows for manually setting of "this"
        call: function (context, func) {
            func.call(context);
        },

        // If not array, then covert to array
        // Otherwise the "each" operations with fail if an object is passed
        array: function (value) {
            return $.isArray(value) ? value : [value];
        }

    };


    // Helpers

    function trim(str) {
        return $.trim(str);
    }

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

});

// Address, Deep Linking
Go.module(function (go, $, fields) {

    // TODO: Implement HTML5 push state

    // URL was just changed to this value
    var _currentAddress;

    // Set the current address
    go.setAddress = function (address) {
        var address = go.formatURL(address),
            hash = go.formatURL(location.hash);
        if (hash != address) {
            _currentAddress = address;
            if (address == "/") location.hash = "";
            else location.hash = go.trimChars(address, "/");
        }
    };

    // Run callback when hash or address has changed
    function runAddressChangeCallback() {
        var address = go.formatURL(location.hash);
        // If address is not current address and isn't held, then run action
        if (address != go.wait && address != _currentAddress) {
            go.run(
                new ActionEvent({ url: address })
            );
        }
    }

    // Native hash change event
    if (("onhashchange" in window) && !($.browser.msie && parseInt($.browser.version, 10) < 8)) {
        $(window).bind("hashchange", runAddressChangeCallback);
    }

    // If no hashchange event, or is IE7 and below, must use polling
    else {
        var prevHash = location.hash;
        setInterval(function () {
            // Compare the current hash with previous
            var curHash = location.hash;
            if (curHash != prevHash) {
                runAddressChangeCallback();
                prevHash = curHash;
            }
        }, 100);
    }

});

// Loading Indicator
Go.module(function (go, $, fields) {

    var loadingHTML,
        config = Go.config(),
        isShown;

    go.showLoading = function () {
            
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

    };

    go.hideLoading = function () {

        //Hide
        loadingHTML.hide();
        isShown = false;

        //Unbind events
        $(window).unbind("scroll._loading");
        $(window).unbind("resize._loading");

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

});

// Storage
Go.module(function (go, $, fields) {
    
    // Store a value to local or session storage
    // Value type is persisted during retrieval
    go.set = function (key, value, permanent) {;
        // Store as object so types are persisted
        // Value can be primative, object or array
        // Use "v" to conserve storage space
        var data = JSON.stringify({ v: value });
        getStore(permanent).setItem(key, data);
    };

    // Get from local or session storage
    go.get = function (key) {
        var value = tryGetItem(key);
        if (value) return JSON.parse(value).v;
        else return null;
    };

    // Remove from local and session storage
    go.remove = function (key) {
        if (getStore().getItem) getStore().removeItem(key);
        else if (getStore(1).getItem) getStore(1).removeItem(key);
    }

    // Helpers

    // Try to get from session storage, then local storage
    function tryGetItem(key) {
        return getStore().getItem(key) || getStore(1).getItem(key);
    }

    // Return either local or session storage
    function getStore(useLocal) {
        return useLocal ? localStorage : sessionStorage;
    }

});

// Persistence
Go.module(function (go, $, fields) {

    // Prefix for key in local/session store
    // Helps to prevent naming conflicts
    // Also used to locate persisted objects
    var prefix = "@go-persisted-object:";
    loadedObjects = [];

    // Persist objects between page reload and sessions
    go.persist = function (name) {

        // Exit if already loaded
        if (loadedObjects[name]) return;

        // Overloaded arguments
        var key = prefix + name,                            // Name of object with prefix
            arg2 = arguments[1],                            // 2nd arg
            arg3 = arguments[2],                            // 3rd arg
            hasPermArg = typeof arg1 == "boolean",          // permanent arg is passed
            permanent = hasPermArg ? arg1 : false,          // permanent storage
            defaults = hasPermArg ? arg1 : arg2;            // default object

        // Get object
        var obj = Go.getProp(name) || // Check memory first
                  Go.get(key) ||            // Else check storage
                  defaults ||               // Else use defaults if provided
                  {};                       // Else just use empty object

        // Add to memory
        // Can be a prop name or a nested, such as "app.namespace.myObject"
        Go.setProp(name, window, obj);

        // Prevent object from being loaded again
        loadedObjects[name] = obj;

        // On page reload or browser closing, we must save object
        saveObjectOnUnload(key, name, permanent);

    };

    // On page load, we must retrieve the objects from storage
    // This is handled in the core Go objects ready event
    // Important: Any shims should be loaded before this
    Go.on("ready", function () {
        // Restore persisted objects from session and local stores
        restoreObjects(false);          //session   
        restoreObjects(true);   //local
    });

    // Retrieves any persisted objects and adds to memory
    // Objects are identified by the key prefix
    function restoreObjects(permanent) {

        //Get store
        var store = permanent ? localStorage : sessionStorage;

        for (var i = 0; i < store.length; i++) {

            // Get key at index
            var key = store.key(i);

            // If begins with prefix, then retrieve
            if (key.indexOf(prefix) == 0) {

                // Get name
                var name = key.replace(prefix, "");

                // Exit if already loaded
                if (loadedObjects[name]) return;

                //Get from storage
                var obj = Go.get(key);

                // If null, then remove
                if (!obj) Go.remove(key);

                // Else add to memory
                else {
                    Go.setProp(name, window, obj);
                    loadedObjects[name] = obj;
                }

                // On page reload or browser closing, we must save object
                saveObjectOnUnload(key, name, permanent);
            }

        }

    }

    // Save object to session or local store
    function saveObjectOnUnload(key, name, permanent) {
        $(window).unload(function () {
            var item = Go.getProp(name);
            Go.set(key, item, permanent);
        });
    }

});


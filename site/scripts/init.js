
//Config
Go.config({

    //Settings
    loadingIndicatorCSS: "loading-indicator",

    //Resource routes
    scriptRoute: "/gojs/site/scripts/{key}.js",
    styleRoute: "/gojs/site/styles/{key}.css",
    viewRoute: "/gojs/site/views/{key}.html",
    imageRoute: "/site/images/{key}",

    //Routes
    routes: [
        //Home route
        {
            route: "/", //Route definition
            defaults: { controller: "view", action: "display", view: "home" }, //Default values
            require: "controllers/view" //Required resources
        },
        //Default controller/action route
        {
            route: "{controller}/{action}"
        },
        //Default display view route
        {
            route: "{view}",
            defaults: { controller: "view", action: "display" },
            require: "controllers/view"
        }
    ]

});

//Highlight code
Go.on("activate", function (e) {

    //Code sections are PRE tags
    var code = $("pre").hide();
    if (code.length) {
        Go.require({
            scripts: "shBrushJScript, shBrushXml",
            styles: "shCore, shCoreDefault",
            require: "shCore"
        },
        function () {
            //Code syntax highlighting
            SyntaxHighlighter.defaults["toolbar"] = false;
            SyntaxHighlighter.highlight(document.body);
            //Replace temp fixes
            //Keep scripts from being run and script highlighter from breaking
            $("code:contains(script-temp)").text("script");
            $("code:contains(body-temp)").text("body");
            $("code:contains(head-temp)").text("head");
            $("code:contains(html-temp)").text("html");
            $("code:contains(href-temp)").text("href");
            //Remote empty attributes 'attr=""'
            $("code:contains(=)").each(function () {
                var el = $(this), sibling = el.next();
                if (sibling.text() == '""') {
                    el.remove();
                    sibling.remove();
                }
            });
            code.show();
        });
    }

});

//Set menu
Go.on("complete", function (e) {

    //Set active menu
    if (e.action && e.action.updater == "content" && e.sender) {
        $("li.active, a.active").removeClass("active");
        e.sender.add(e.sender.parent()).addClass("active");
    }

});

//Auto-load controllers
Go.on("run", function (e) {

    var ctrl = e.values.controller, action = e.values.action;
    if (ctrl && action) e.require = "controllers/" + ctrl;

});

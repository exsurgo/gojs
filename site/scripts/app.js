

//Config
Go.config({
    //Settings
    loadingIndicatorCSS: "loading-indicator",
    prefixControllerNameToViews: false,
    //Resource routes
    scriptRoute: "/gojs/site/scripts/{key}.js",
    styleRoute: "/gojs/site/styles/{key}.css",
    controllerRoute: "/gojs/site/controllers/{key}.js",
    modelRoute: "/gojs/site/models/{key}.js",
    viewRoute: "/gojs/site/views/{key}.html",
    imageRoute: "/gojs/site/images/{key}",
});

//Routes
Go.route([
    //Home route
    {
        route: "/", //Route definition
        defaults: { controller: "view", action: "display", view: "home" } //Default values
    },
    //Default controller/action route
    {
        route: "{controller}/{action}"
    },
    //Default display view route
    {
        route: "{view}",
        defaults: { controller: "view", action: "display" }
    }
]);

//Auto-load controllers
Go.on("beforerun", function (e) {

    if (e.values) {
        var ctrl = e.values.controller, action = e.values.action;
        if (ctrl && action) e.require = { controllers: ctrl };
    }

});

//Store home content
Go.on("ready", function () {
    homeContent = $("[go-content]").html();
});

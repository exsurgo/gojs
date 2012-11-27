
//Config
Go.config({

    //Settings
    loadingIndicatorCSS: "loading-indicator",

    //Resource routes
    scriptRoute: "js/{key}.js",
    styleRoute: "css/{key}.css",
    viewRoute: "views/{key}.html",
    imageRoute: "img/{key}",

    //Routes
    routes: [
        //Main route
        {
            route: "/", //Route definition
            defaults: { controller: "todos", action: "main" }, //Default values
            require: "todos" //Require todo controller
        },
        //Default routes
        { route: "{controller}/{action}/{id}" },
        { route: "{controller}/{action}" }
    ]

});

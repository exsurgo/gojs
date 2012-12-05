
//Config
Go.config({
    //Settings
    loadingIndicatorCSS: "loading-indicator",
    prefixControllerNameToViews: false,
    //Resource routes
    controllerRoute: "controllers/{key}.js",
    modelRoute: "models/{key}.js",
    viewRoute: "views/{key}.html",
    scriptRoute: "libs/{key}.js",
    styleRoute: "styles/{key}.css",
    imageRoute: "images/{key}"
});

// Routes
Go.route([
    // Main route
    {
        route: "/", // Route definition
        defaults: { controller: "todos", action: "main" }, // Default values
        require: {
            controllers: "todos",       // Require /controllers/todos.js
            styles: "app",              // Require /styles/app.css
            require: {
                models: "todos"         // Nested dependency, Require /models/todos.js
            }
        }
    },
    // Default routes
    { route: "{controller}/{action}/{id}" },    // Example  /todos/edit/123
    { route: "{controller}/{action}" }          // Example  /todos/list
]);

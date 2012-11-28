
//Config
Go.config({
    scriptRoute: "{key}.js", 
    styleRoute: "styles/{key}.css", 
    viewRoute: "views/{key}.html", 
    loadingIndicatorCSS: "loading-indicator"
});

//Routes
Go.route([
    //Main route
    {
        route: "/", //Route definition
        defaults: { controller: "todos", action: "main" }, //Default values
        require: {
            scripts: "controllers/todos",   //Require controllers/todos.js
            styles: "app",                  //Require styles/app.css
            require: "models/todos"         //Nested dependency
        }
    },
    //Default routes
    { route: "{controller}/{action}/{id}" },    //Example  /todos/edit/123
    { route: "{controller}/{action}" }          //Example  /todos/list
]);

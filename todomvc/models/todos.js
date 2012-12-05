
var Todos;

(function () {

    // Mark object a peristent
    // GoJ will automatically load and save
    // this object on page load and unload
    // Assign the initial value as []
    Go.persist("Todos", []);

    // Public methods
    
    Todos.get = function (id) {
        return Todos.where("id=='{0}'", id)[0];
    };

    Todos.each = function (callback) {
        $.each(Todos, callback);
    };

    Todos.where = function (condition, values) {
        condition = Go.format(condition, values);
        var func = "var __=[]; \r\n$(this).each(function(i,v) { \r\n with(v) {\r\n if (" + condition + ") __.push(v); \r\n} \r\n}); \r\nreturn __";
        return (new Function(func)).call(Todos);
    };

    Todos.query = function (type) {
        if (type == "active") return Todos.where("completed != true");
        else if (type == "completed") return Todos.where("completed == true");
        else return Todos;
    };

    Todos.counts = function () {
        var counts = {
            remaining: Todos.where("completed == false").length,
            completed: Todos.where("completed == true").length
        };
        counts.total = counts.remaining + counts.completed;
        return counts;
    };

    Todos.create = function (title) {
        var todo = {
            title: title,
            id: Go.createRandomId(),
            completed: false
        };
        Todos.push(todo);
        return todo;
    };

    Todos.destroy = function (id) {
        Todos.each(function (i) {
            if (this.id == id) Todos.splice(i, 1);
        });
    };

    Todos.destroyCompleted = function (id) {
        Todos.each(function(i, value) {
            if (value && value.completed) Todos.destroy(value.id);
        });
    };

})();
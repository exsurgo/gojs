
var Todos = (function () {

    var model = {},
        todos = [];

    model.get = function (id) {
        var len = todos.length;
        for (var i = 0; i < len; i++) {
            if (id == todos[i].id) return todos[i];
        }
    };

    model.query = function (query) {

        //Run query
        var result = [];
        $(todos).each(function (i, value) {
            if (query == "active" && !value.completed) result.push(value);
            else if (query == "completed" && value.completed) result.push(value);
            else if (!query) result.push(value);
        });

        //Return result
        return { todos: result, count: todos.length, query: query };

    };

    model.counts = function () {
        var counts = {
            remaining: 0,
            completed: 0
        };
        $.each(todos, function () {
            if (this.completed) counts.completed++;
            else counts.remaining++;
        });
        counts.total = counts.remaining + counts.completed;
        return counts;
    };

    model.create = function (title) {
        var todo = {
            title: title,
            id: Math.random().toString().replace(".", ""),
            completed: false
        };
        todos.push(todo);
        return todo;
    };

    model.destroy = function (id) {
        $.each(todos, function (i) {
            if (this.id == id) todos.splice(i, 1);
        });
    };

    model.destroyCompleted = function (id) {
        $(todos).each(function (i, value) {
            if (value.completed) Todos.destroy(value.id);
        });
    };

    return model;

})();
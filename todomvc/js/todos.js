
//Model
var TodoModel = {

    get: function(id) {
        var len = todos.length;
        for (var i = 0; i < len; i++) {
            if (id == todos[i].id) return todos[i];
        }
    },

    getAll: function () {
        if (!window.todos) window.todos = [];
        return {
            todos: todos,
            count: todos.length
        };
    },

    getActive: function () {

    },

    getCompleted: function () {

    },

    getCounts: function () {
        var counts = {
            remaining: 0,
            completed: 0
        };
        $.each(todos, function() {
            if (this.completed) counts.completed++;
            else counts.remaining++;
        });
        counts.total = counts.remaining + counts.completed;
        return counts;
    },

    add: function (e) {
        var todo = {
            title: e.sender.find("input").val(),
            id: Math.random().toString().replace(".", ""),
            completed: false
        };
        todos.push(todo);
        return todo;
    },

    destroy: function (e) {
        var id = e.sender.parents("data-id").attr("data-id");
        $.each(todos, function (i) {
            if (this.id = id) todos.splice(i, 1);
        });
    },

};

//Controller
var TodoController = new Controller("todos", {

    main: new Action({
        require: {
            views: "row"
        },
        title: "GoJS • TodoMVC",
        updater: "content",
        view: "main",
        model: TodoModel.getAll,
        complete: function() {
            TodoController.updateView();
        }
    }),

    showAll: function (e) {

    },

    showActive: function (e) {

    },

    showCompleted: function (e) {

    },

    add: new Action({
        updater: {
            name: "append",
            target: "#todo-list"
        },
        view: "row",
        model: TodoModel.add,
        complete: function (e) {
            e.sender[0].reset();
            setTimeout(function() { e.sender.find("input").focus() }, 300);
            TodoController.updateView();
        }
    }),

    destroy: new Action({
        model: TodoModel.destory,
        complete: function (e) {
            e.sender.closest("li").remove();
            TodoController.updateView();
        }
    }),

    toggle: function (e) {

        //Locals
        var check = e.sender,
            id = e.values.id,
            li = check.closest("li"),
            completed = li.hasClass("completed"),
            todo = TodoModel.get(id);

        //Toggle completion status
        li.toggleClass("completed");
        todo.completed = !completed;

        //Update footer
        TodoController.updateView();

    },

    toggleAll: function (e) {
        
        var isChecked = e.sender.is(":checked");

        //Each incomplete task
        $("#todo-list > li").each(function() {
            
            //Locals
            var li = $(this),
                id = li.data("id"),
                checkbox = li.find(":checkbox")[0],
                todo = TodoModel.get(id);

            //Set complete
            if (isChecked) {
                li.addClass("completed");
                checkbox.checked = true;
                todo.completed = true;
            }

            //Set incomplete
            else { 
                li.removeClass("completed");
                checkbox.checked = false;
                todo.completed = false;
            }

        });

        //Update footer
        TodoController.updateView();
    },

    clearCompleted: function (e) {

    },

    updateView: new Action({
        updater: {
            name: "insert",
            target: "#footer-pane"
        },
        view: "footer",
        model: TodoModel.getCounts,
        complete: function (e) {
            //Set toggle all checkbox
            var checkbox = $("#toggle-all"),
                model = e.model;
            if (model.total == 0) checkbox.hide();
            else {
                checkbox.show();
                if (model.completed == model.total) checkbox[0].checked = true;
                else checkbox[0].checked = false;
            }
        }
    })

});

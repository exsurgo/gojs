
var TodoController = new Controller("todos", {

    main: new Action({
        require: {
            views: "row"
        },
        title: "GoJS • TodoMVC",
        updater: "content",
        view: "main",
        model: function (e) {
            return Todos.query(e.values.query);
        },
        complete: function (e) {
            e.controller.query = e.values.query;
            TodoController.updateView();
        }
    }),

    create: new Action({
        updater: {
            name: "append",
            target: "#todo-list"
        },
        view: "row",
        model: function (e) {
            var title = e.sender.find("input").val()
            return Todos.create(title);
        },
        complete: function (e) {
            e.sender[0].reset();
            setTimeout(function () { e.sender.find("input").focus() }, 100);
            TodoController.updateView();
        }
    }),

    destroy: function (e) {
        Todos.destroy(e.values.id);
        e.sender.closest("li").remove();
        TodoController.updateView();
    },

    toggle: function (e) {

        //Locals
        var check = e.sender,
            id = e.values.id,
            li = check.closest("li"),
            completed = li.hasClass("completed"),
            todo = Todos.get(id);

        //Toggle completion status
        li.toggleClass("completed");
        todo.completed = !completed;

        //Update footer
        TodoController.updateView();

    },

    toggleAll: function (e) {

        var isChecked = e.sender.is(":checked");

        //Each incomplete task
        $("#todo-list > li").each(function () {

            //Locals
            var li = $(this),
                id = li.data("id"),
                checkbox = li.find(":checkbox")[0],
                todo = Todos.get(id);

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
        Todos.destroyCompleted();
        TodoController.main();
    },

    updateView: new Action({
        updater: {
            name: "insert",
            target: "#footer-pane"
        },
        view: "footer",
        model: Todos.counts,
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

            //Set active links
            //TODO: Implement this with templates
            $("#filters a").removeClass("selected");
            if (e.controller.query == "active") $("#query-active").addClass("selected");
            else if (e.controller.query == "completed") $("#query-completed").addClass("selected");
            else $("#query-all").addClass("selected");
        }
    })

});

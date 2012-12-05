
var TodosController = new Controller("todos", {

    main: new Action({
        require: {
            views: "row"
        },
        title: "GoJS • TodoMVC",
        updater: "content",
        view: "main",
        model: function () {
            return Todos.query(this.values.query)
        },
        complete: function (e) {
            TodosController.updateView(e.values);
        },
        focus: "#new-todo"
    }),

    create: new Action({
        updater: "append: #todo-list",
        view: "row",
        model: function (e) {
            var title = this.sender.find("input").val()
            return Todos.create(title);
        },
        complete: function (e) {
            e.sender[0].reset();
            TodosController.updateView(e.values);
        },
        focus: "#new-todo"
    }),

    edit: new Action({
        hide: "#todo-{id} .view",
        show: "#todo-{id} .edit",
        focus: "#todo-{id} :text"
    }),

    save: new Action({
        updater: "replace",
        view: "row",
        model: function () {
            var id = this.values.id,
                title = this.sender.find("input").val(),
                todo = Todos.get(id);
            todo.title = title;
            return todo;
        }
    }),

    destroy: function (e) {
        Todos.destroy(e.values.id);
        e.sender.closest("li").remove();
        TodosController.updateView(e.values);
    },

    toggle: function (e) {

        //Locals
        var check = e.sender,
            id = e.values.id,
            li = check.closest("li"),
            completed = li.hasClass("completed"),
            todo = Todos.where("id=='{0}'", id)[0];

        //Toggle completion status
        li.toggleClass("completed");
        todo.completed = !completed;

        //Update footer
        TodosController.updateView(e.values);

    },

    toggleAll: function (e) {

        var isChecked = e.sender.is(":checked");

        //Each incomplete task
        $("#todo-list > li").each(function () {

            //Locals
            var li = $(this),
                id = li.data("id"),
                checkbox = li.find(":checkbox"),
                todo = Todos.where("id=='{0}'", id)[0];

            //Set complete
            if (isChecked) {
                li.addClass("completed");
                checkbox.prop("checked", true);
                todo.completed = true;
            }

            //Set incomplete
            else {
                li.removeClass("completed");
                checkbox.prop("checked", false);
                todo.completed = false;
            }

        });

        //Update footer
        TodosController.updateView(e.values);

    },

    clearCompleted: function (e) {
        Todos.destroyCompleted();
        TodosController.main();
    },

    updateView: new Action({
        updater: "insert: #footer-pane",
        view: "footer",
        model: Todos.counts,
        complete: function (e) {
            
            //Set toggle all checkbox
            var checkbox = $("#toggle-all"), model = e.model;
            if (model.total == 0) checkbox.hide();
            else {
                checkbox.show();
                if (model.completed == model.total) checkbox[0].checked = true;
                else checkbox[0].checked = false;
            }

        }
    })

});

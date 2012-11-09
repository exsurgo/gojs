
var ViewController = new Controller("view", {

    display: new Action({
        updater: "content",
        title: function (e) {
            return e.element.data("title");
        },
        remote: function (e) {
            return "/gojs/site/views/" + e.values.view + ".html";
        }
    })

});
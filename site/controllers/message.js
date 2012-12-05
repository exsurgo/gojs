
var MessageController = new Controller("message", {

    speak: new Action({
        remote: "/gojs/site/data/helloworld.json",
        response: function (e) {
            alert(e.data.message);
        }
    })

});
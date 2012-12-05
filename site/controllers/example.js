
var ExampleController = new Controller("example", {

    updateContent: new Action({
        updater: "content",
        title: "Content Update",
        view: "sampleview"
    }),

    updateWindow: new Action({
        updater: "window",
        title: "A Window Update Example",
        view: "sampleview"
    })

});
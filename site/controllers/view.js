
var ViewController = new Controller("view", {

    display: function(e) {

        // Show loading indicator
        Go.showLoading();

        // Manually load views since they use many single brackets
        // The view engine uses them for rendering
        var view = e.values.view,
            ctrl = e.controller;
           
        // Home
        if (e.url == "/") {
            Go.update("content", homeContent);
            document.title = $(ctrl.homeHTML).attr("data-title");
            Go.hideLoading();
            Go.setAddress("/");
        }

        // Request views
        else $.get("/gojs/site/views/" + view + ".html", function (html) {

            Go.update("content", html);
            Go.setAddress(view);

            // Code sections are PRE tags
            var code = $("pre").hide();
            if (code.length) {
                Go.require({
                    scripts: "shBrushJScript, shBrushXml",
                    styles: "shCore, shCoreDefault",
                    require: "shCore"
                },
                function () {
                    //Code syntax highlighting
                    SyntaxHighlighter.defaults["toolbar"] = false;
                    SyntaxHighlighter.highlight(document.body);
                    //Replace temp fixes
                    //Keep scripts from being run and script highlighter from breaking
                    $("code:contains(script-temp)").text("script");
                    $("code:contains(body-temp)").text("body");
                    $("code:contains(head-temp)").text("head");
                    $("code:contains(html-temp)").text("html");
                    $("code:contains(href-temp)").text("href");
                    //Remote empty attributes 'attr=""'
                    $("code:contains(=)").each(function () {
                        var el = $(this), sibling = el.next();
                        if (sibling.text() == '""') {
                            el.remove();
                            sibling.remove();
                        }
                    });
                    code.show();
                });
            }

            // Hide loading
            Go.hideLoading();

            // Set title
            document.title = $("[data-title]:first").attr("data-title");

        });

        // Set active menu
        if (e.url) {
            var menuLink = $("a[href='#" + e.url.replace("/", "") + "']");
            if (menuLink.length) {
                $("li.active").removeClass("active");
                menuLink.parent().addClass("active");
            }
        }
        
    }

});
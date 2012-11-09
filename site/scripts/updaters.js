
/*
*   Custom Updaters
*   Add any custom update types here.  The update type (data-update="{name}") should match the name of the function.
*   The function signature should be as follows...  functionName: function(e)
*/
Go.addUpdaters({

    /*
    *   Window - display content in a dialog window
    *   Dependent on jQuery UI Dialog
    *   "data-close=true" to close window
    *   title: {string}
    *   modal: {bool} 
    *   width: {int}
    *   height: {int}
    *   maxWidth: {int}
    *   maxHeight: {int}
    *   minWidth: {int}
    *   minHeight: {int}
    *   nopad: {bool}
    *   overflow: {bool}
    *   noClose: {bool}
    *   icon: {string}
    */
    window: function (e) {
        Go.require({ scripts: "Plugins/jQueryUI", styles: "Plugins/jQueryUI" }, function () {

            //Locals
            var element = e.element,
                id = element.attr("id"),
                metadata = e.updateData;

            //Get content area
            var contentArea = $(Go.config.contentSelector);

            //Close existing window
            $("#" + id).dialog("destroy").remove();

            //No close
            var noClose = metadata.noClose === true;

            //Window params
            var params = $.extend(metadata,
            {
                title: metadata.title || (e.action && e.action.title),
                modal: metadata.modal == false ? false : true,
                resizable: false,
                width: metadata.width ? metadata.width : "auto",
                height: metadata.height ? metadata.height : "auto",
                closeOnEscape: !noClose,
                open: function () {
                    var win = $(this).parent(".ui-dialog");
                    element.removeAttr("id");
                    win.attr("id", id);
                    var winTitle = win.find(".ui-dialog-titlebar");
                    var winContent = win.find(".ui-dialog-content");
                    //Overflow
                    if (metadata.overflow) win.find(".ui-dialog-content").andSelf().css("overflow", "visible");
                    //No padding
                    if (metadata.nopad) winContent.css("padding", 0);
                    //Icon
                    if (metadata.icon) winTitle.find(".ui-dialog-title").prepend("<img src='/Images/" + metadata.icon + ".png'/>");
                    //Recenter on window resize
                    $(window).bind("resize." + id, function () {
                        //Recenter if exists
                        if (win.length) win.position({ at: "center", my: "center", of: window });
                        //Unbind if doesn't exists
                        else $(window).unbind("resize." + id);
                    });
                    //Recenter on delay
                    setTimeout(function () { win.position({ at: "center", my: "center", of: window }); }, 10);
                    //Hide close button
                    if (noClose) $(".ui-dialog-titlebar-close").remove();
                    //Bind close event
                    win.bind("close", closeWindow);
                },
                close: function () {
                    //Unbind window resize handler
                    $(window).unbind("resize." + id);
                    //Remove window
                    $(this).remove();
                },
                drag: function () {
                    //Unbind window resize handler
                    $(window).unbind("resize." + id);
                    //Remove recenter
                    $(this).parents(".ui-dialog:first");
                }
            });

            //Show window
            element.dialog(params);

            //Close function
            function closeWindow() {
                if ($.fn.dialog) $("#" + id).closest(".ui-dialog").dialog("destroy").remove();
            }

            //Close window on click
            element.find("[data-close]").click(closeWindow);

        });
    },

    /*
    *   Show update as a full screen window
    */
    fullscreen: function (e) {

        //Hide other elements
        var body = $("body"),
            allVisible = body.children(),
            element = e.element;

        //Hide all visible elements
        allVisible.hide();

        //Append content
        body.append(e.element);

        //Close full screen
        body.find("[close-fullscreen]").click(function (e) {
            element.remove();
            allVisible.show();
            e.preventDefault();
        });

    },

    /*
    *   Expand - expands an area from source to full screen
    *   source - the area that is expanded
    */
    //TODO: Cache content area in Go
    expand: function (e) {

        //Source
        var source = e.action.source;

        //Expand effect
        if (source && e.sender) {

            //Need to delay next step
            e.delay = 850;

            //Eval source
            if ($.isFunction) source = source(e);

            //Run effect
            Go.require({ scripts: "Plugins/jQueryUI", styles: "Plugins/jQueryUI" }, function () {
                $(source).effect("transfer", { to: $("body") }, 800, updateContent);
            });

        }

        //No effect
        else updateContent();

        //Update content helper
        function updateContent() {
            //Address
            Go.setAddress(e.address || e.url);
            //Page Title
            if (e.title) document.title = e.title;
            //Content
            $("#content").empty().append(e.element);
        };

    },

    /*
    *   Side - displays in an expanded right column
    */
    side: function (e) {
        Go.require({ scripts: "Plugins/PageSlide", styles: "Plugins/PageSlide" }, function () {
            $.pageslide({ direction: "left", href: "#" });
        });
    },

    /*
    *   Row - replaces or adds a row to a table
    *   Dependent on jQuery UI highlight
    *   target: {selector}
    */
    row: function (e) {

        //Get id
        var element = e.element,
            id = element.attr("id"),
            target = e.updateData.target;

        //Get self or first table
        if (!target) target = $(Go.config.contentSelector).find("table:first");
        var table = $(target);
        if (table[0].tagName != "TABLE") table = table.find("table:first");

        //Add tbody
        if (!table.find("tbody").length) table.append("<tbody></tbody>");

        //Replace existing row
        if (table.find("#" + id).length) table.find("#" + id).replaceWith(element);

        //Add new row
        else {
            var rows = table.find("tbody > tr:not(:has(th))");
            if (metadata.position == "bottom") rows.last().after(element);
            else rows.first().before(element);
        }

        //Select row
        $(".row-select").removeClass("row-select");
        var row = table.find("#" + id);
        row.addClass("row-select");

        //Hide empty section
        table.next(".empty:first").hide();

        //Highlight row
        row.effect("highlight", { color: "#FFFFCC" }, 1800);
    },

    /*
    *   SubRow - adds a row in a table under another row
    *   "data-close=true" for close event
    *   target: {selector}
    */
    subrow: function (e) {

        //Replace if exists
        var element = e.element,
            sender = e.sender,
            metadata = e.updateData,
            sub = $("#" + element.attr("id"));
        if (sub.length) sub.replaceWith(element);

        //Add new
        else {
            //Get target row, subrow goes after
            var tr = metadata.target ? $(metadata.target) : $(sender).parents("tr:first");
            //Show in content area if not found
            if (tr.length == 0) $(Go.config.contentSelector).html(element).find(".close-button").remove();
            //Add row
            else {
                if (!tr.next().hasClass("subrow")) {
                    var cols = tr.find("> td").length;
                    tr.after("<tr class='subrow'><td colspan='" + cols + "'></td></tr>");
                }
                //Selected row
                $(".row-select").removeClass("row-select");
                $(tr).closest("tr").addClass("row-select");
                //Add update
                var zone = tr.next().find("td:first");
                zone.prepend(element);
                //IE8 Rendering Fix
                if ($.browser.msie && $.browser.version == "8.0") zone.find("table").hide().slideDown(1);
            }
        }

        //        //Add hover-over close button
        //        var close = $("<span title='close' data-close='true' class='close-button hide'/>");
        //        element
        //            .prepend(close)
        //            .mouseover(function () {
        //                close.show().position({ my: "right top", at: "right top", of: element, offset: "-3 3" });
        //            }).mouseout(function () {
        //                close.hide();
        //            });

        //Close event
        element.find("[data-close=true]").click(function () {
            var el = $(this);
            var subrow = el.closest(".subrow");
            el.closest("[data-update]").remove();
            if (!subrow.find("td:first > *:first").length) subrow.remove();
        });

    }

});
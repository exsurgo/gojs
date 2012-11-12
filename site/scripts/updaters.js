
/*
*   Custom Updaters
*   Add any custom update types here.  
*   The function signature should be as follows...  functionName: function(e)
*/
Go.addUpdaters({

    /*
    *   Window - display content in a dialog window
    *   Dependent on jQuery UI Dialog
	*/
    window: function (e) {
		
		//Require jQuery UI
        Go.require({ scripts: "jqueryui", styles: "jqueryui" }, function () {

            //Locals
            var element = e.element,
                metadata = e.updateData;

            //Show window
            element.dialog({
                title: metadata.title || (e.action && e.action.title),
                modal: true,
                resizable: false,
                width: metadata.width ? metadata.width : "auto",
                height: metadata.height ? metadata.height : "auto",
            });

        });
		
    }

});
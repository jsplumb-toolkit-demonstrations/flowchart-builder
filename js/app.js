(function () {

    jsPlumbToolkitBrowserUI.ready(function () {

        // ------------------------ toolkit setup ------------------------------------

        // This function is what the toolkit will use to get an ID from a node.
        var idFunction = function (n) {
            return n.id;
        };

        // This function is what the toolkit will use to get the associated type from a node.
        var typeFunction = function (n) {
            return n.type;
        };

// ------------------------- dialogs -------------------------------------

        var dialogs = new jsPlumbToolkitDialogs.Dialogs({
            selector: ".dlg"
        });

// ------------------------- / dialogs ----------------------------------

        // get the various dom elements
        var mainElement = document.querySelector("#jtk-demo-flowchart"),
            canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
            miniviewElement = mainElement.querySelector(".miniview"),
            nodePalette = mainElement.querySelector(".node-palette"),
            controls = mainElement.querySelector(".controls");

        // Declare an instance of the Toolkit, and supply the functions we will use to get ids and types from nodes.
        var toolkit = jsPlumbToolkitBrowserUI.newInstance({
            idFunction: idFunction,
            typeFunction: typeFunction,
            nodeFactory: function (type, data, callback) {
                dialogs.show({
                    id: "dlgText",
                    title: "Enter " + type + " name:",
                    onOK: function (d) {
                        data.text = d.text;
                        // if the user entered a name...
                        if (data.text) {
                            // and it was at least 2 chars
                            if (data.text.length >= 2) {
                                // set an id and continue.
                                data.id = toolkit.uuid();
                                callback(data);
                            }
                            else
                            // else advise the user.
                                alert(type + " names must be at least 2 characters!");
                        }
                        // else...do not proceed.
                    }
                });
            },
            beforeStartConnect:function(node, edgeType) {
                // limit edges from start node to 1. if any other type of node, return a payload for the edge.
                // if there is already a label set for the edge (say, if it was connected programmatically or via
                // edge undo/redo), this label is ignored.
                return (node.data.type === "start" && node.getEdges().length > 0) ? false : { label:"..." };
            }
        });

// ------------------------ / toolkit setup ------------------------------------

// ------------------------ rendering ------------------------------------

        var _editLabel = function(edge, deleteOnCancel) {
            dialogs.show({
                id: "dlgText",
                data: {
                    text: edge.data.label || ""
                },
                onOK: function (data) {
                    toolkit.updateEdge(edge, { label:data.text || "" });
                },
                onCancel:function() {
                    if (deleteOnCancel) {
                        toolkit.removeEdge(edge);
                    }
                }
            });
        };

        // Instruct the toolkit to render to the 'canvas' element. We pass in a view of nodes, edges and ports, which
        // together define the look and feel and behaviour of this renderer.  Note that we can have 0 - N renderers
        // assigned to one instance of the Toolkit..
        var renderer = window.renderer = toolkit.render(canvasElement, {
            view: {
                nodes: {
                    "start": {
                        templateId: "tmplStart"
                    },
                    "selectable": {
                        events: {
                            tap: function (params) {
                                toolkit.toggleSelection(params.node);
                            }
                        }
                    },
                    "question": {
                        parent: "selectable",
                        templateId: "tmplQuestion"
                    },
                    "action": {
                        parent: "selectable",
                        templateId: "tmplAction"
                    },
                    "output":{
                        parent:"selectable",
                        templateId:"tmplOutput"
                    }
                },
                // There are two edge types defined - 'yes' and 'no', sharing a common
                // parent.
                edges: {
                    "default": {
                        editable:true,
                        anchor:"AutoDefault",
                        endpoint:"Blank",
                        connector: {type:"Orthogonal", options:{ cornerRadius: 3, midpoint:"${midpoint}" } },
                        paintStyle: { strokeWidth: 2, stroke: "rgb(132, 172, 179)", outlineWidth: 3, outlineStroke: "transparent" },	//	paint style for this edge type.
                        hoverPaintStyle: { strokeWidth: 2, stroke: "rgb(67,67,67)" }, // hover paint style for this edge type.
                        events: {
                            click:function(p) {
                                edgeEditor.startEditing(p.edge, {
                                    deleteButton:true,
                                    onMaybeDelete:function(edge, connection, doDelete) {
                                        dialogs.show({
                                            id: "dlgConfirm",
                                            data: {
                                                msg: "Delete Edge"
                                            },
                                            onOK: doDelete
                                        });
                                    }
                                });
                            }
                        },
                        overlays: [
                            { type:"Arrow", options:{ location: 1, width: 10, length: 10 }}
                        ]
                    },
                    "response":{
                        parent:"default",
                        overlays:[
                            {
                                type: "Label",
                                options: {
                                    label: "${label}",
                                    events: {
                                        click: function (params) {
                                            _editLabel(params.edge);
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },

                ports: {
                    "start": {
                        edgeType: "default"
                    },
                    "source": {
                        maxConnections: -1,
                        edgeType: "response"
                    },
                    "target": {
                        maxConnections: -1,
                        isTarget: true,
                        dropOptions: {
                            hoverClass: "connection-drop"
                        }
                    }
                }
            },
            // Layout the nodes using an absolute layout
            layout: {
                type: "Absolute"
            },
            events: {
                canvasClick: function (e) {
                    toolkit.clearSelection();
                    edgeEditor.stopEditing();
                },
                "edge:add":function(params) {
                    if (params.addedByMouse) {
                        _editLabel(params.edge, true);
                    }
                }
            },
            lassoInvert:true,
            lassoEdges:true,
            consumeRightClick: false,
            dragOptions: {
                filter: ".jtk-draw-handle, .node-action, .node-action i, .connect",
                magnetize:true
            },
            plugins:[
                { type: "miniview", options: {container: miniviewElement } }
            ]
        });

// ----------------------------------------------------------------------------------------------------------------------

        /*
        a TEST of addSourceSelector. this is an alternative to the `jtk-source` elements in the templates.

           currently the `jtk-source` element supports a few attributes:

            port-type  - the type of port represented by the source
            port-id    - the id of the port represented by the source
            edge-type  - the type of edge to create when dragging from this source
            scope      - the scope for the port. used when matching draggables.

        All of those attributes are optional. With addSourceSelector we want, of course, to still support these things.

        But we want to support them in two ways - firstly, on the element in the html:

        <div class=".connect" data-jtk-port-id="foo" data-port-type="portType" ....>...</div>

        These should be picked up by the addSourceSelector mechanism and set as data for the endpoint that is created. Currently
        there is an `extract` mechanism supported, but that only sets data on the connection; something needs to be done about that.

        Secondly, we want to support these in the definition, kind of like:

        renderer.jsplumb.addSourceSelector(".connect", {
            portType:"portType",
            portId:"foo"
        })

        but we dont in fact want to make people access the community instance. instead it should be part of the render:

        instance.render(container, {
            ...
            sourceSelectors:{
                ".connect":{
                    portType:"portType"
                }
            }
        }

        is that any good? or can it instead/also be mapped in the view?:

        ports: {
                    "start": {
                        edgeType: "default"
                    },
                    "source": {
                        maxConnections: -1,
                        edgeType: "response",
                        sourceSelector:".connect" <--------------------------
                    },

                    "target": {
                        maxConnections: -1,
                        isTarget: true,
                        dropOptions: {
                            hoverClass: "connection-drop"
                        }
                    }
                }

          I kind of like that, but how would the fact that a whole node is a target be represented? presumably as a `targetSelector`
          on the node definition in the view, which is not so appealing. And then there is this issue:

          <jtk-target port-type="target"/>

          ...the target, which is the whole node, actually maps to a logical port.  So maybe this then:

          instance.render(container, {
            ...

            selectors:{
                ".connect":{
                    portType:"portType",
                    isSource:true
                },
                ".flowchart-object":{
                    portType:"target",
                    isTarget:true
                }
            }

            ...
        }

         */

        renderer.jsplumb.addSourceSelector(".connect")

// ----------------------------------------------------------------------------------------------------------------------

        var edgeEditor = jsPlumbToolkitConnectorEditors.newInstance(renderer);

        var datasetView = new jsPlumbToolkitSyntaxHighlighter.ToolkitSyntaxHighlighter(toolkit, ".jtk-demo-dataset");

        var undoredo = jsPlumbToolkitUndoRedo.newInstance({
            surface:renderer,
            onChange:function(undo, undoSize, redoSize) {
                controls.setAttribute("can-undo", undoSize > 0);
                controls.setAttribute("can-redo", redoSize > 0);
            },
            compound:true
        });

        renderer.on(controls, "tap", "[undo]", function () {
            undoredo.undo();
        });

        renderer.on(controls, "tap", "[redo]", function () {
            undoredo.redo();
        });

        // Load the data.
        toolkit.load({
            url: "../data/copyright.json",
            onload:function() {
                renderer.zoomToFit();
            }
        });

        // listener for mode change on renderer.
        renderer.bind("modeChanged", function (mode) {
            // jsPlumb.removeClass(controls.querySelectorAll("[mode]"), "selected-mode");
            // jsPlumb.addClass(controls.querySelectorAll("[mode='" + mode + "']"), "selected-mode");
        });

        // pan mode/select mode
        renderer.on(controls, "tap", "[mode]", function () {
            renderer.setMode(this.getAttribute("mode"));
        });

        // on home button click, zoom content to fit.
        renderer.on(controls, "tap", "[reset]", function () {
            toolkit.clearSelection();
            renderer.zoomToFit();
        });

        // on clear button, perhaps clear the Toolkit
        renderer.on(controls, "tap", "[clear]", function() {
            if (toolkit.getNodeCount() === 0 || confirm("Clear flowchart?")) {
                toolkit.clear();
            }
        });

        // configure Drawing tools.
        // new jsPlumbToolkit.DrawingTools({
        //     renderer: renderer
        // });

        //
        // node delete button.
        //
        renderer.on(canvasElement, "tap", ".node-delete", function () {
            var info = renderer.getObjectInfo(this);
            dialogs.show({
                id: "dlgConfirm",
                data: {
                    msg: "Delete '" + info.obj.data.text + "'"
                },
                onOK: function () {
                    toolkit.removeNode(info.obj);
                }
            });
        });

        // change a question or action's label
        renderer.on(canvasElement, "tap", ".node-edit", function () {
            // getObjectInfo is a method that takes some DOM element (this function's `this` is
            // set to the element that fired the event) and returns the toolkit data object that
            // relates to the element. it ascends through parent nodes until it finds a node that is
            // registered with the toolkit.
            var info = renderer.getObjectInfo(this);
            dialogs.show({
                id: "dlgText",
                data: info.obj.data,
                title: "Edit " + info.obj.data.type + " name",
                onOK: function (data) {
                    if (data.text && data.text.length > 2) {
                        // if name is at least 2 chars long, update the underlying data and
                        // update the UI.
                        toolkit.updateNode(info.obj, data);
                    }
                }
            });
        });

// ------------------------ / rendering ------------------------------------


// ------------------------ drag and drop new nodes -----------------

        //
        // Here, we are registering elements that we will want to drop onto the workspace and have
        // the toolkit recognise them as new nodes. From 1.14.7 onwards we're using the SurfaceDropManager for this,
        // which offers the simplest way to configure node/group drop, including dropping onto an edge.
        // For more information, search for SurfaceDropManager in the docs.
        //
        //  source: the element containing draggable nodes
        //  selector: css3 selector identifying elements inside `source` that ae draggable
        //  dataGenerator: this function takes a DOM element and returns some default data for a node of the type represented by the element.

        jsPlumbToolkitDrop.createSurfaceManager({
            source:nodePalette,
            selector:"div",
            surface:renderer,
            dataGenerator: function (el) {
                return {
                    w:140,
                    h:140,
                    type:el.getAttribute("data-node-type")
                };
             }
        });

// ------------------------ / drag and drop new nodes -----------------

// -------------------- printing --------------------------

        // register a handler in the client side. the server will look for the handler with this ID.
        jsPlumbToolkitPrint.registerHandler(renderer, "jsplumb-demo-print");

    });

})();

import {ready, newInstance, SurfaceRenderOptions, Surface, DrawingToolsPlugin, MiniviewPlugin } from "@jsplumbtoolkit/browser-ui"
import { Dialogs } from "@jsplumbtoolkit/dialogs"
import {Edge, Vertex} from "@jsplumbtoolkit/core"
import { EdgePathEditor } from "@jsplumbtoolkit/connector-editors"
import { ToolkitSyntaxHighlighter } from "@jsplumb/json-syntax-highlighter"
import { Manager } from "@jsplumbtoolkit/undo-redo"
import { EVENT_TAP, Connection, forEach } from "@jsplumbtoolkit/core"
import { createSurfaceManager } from "@jsplumbtoolkit/drop"
import { registerHandler } from "@jsplumbtoolkit/print"


ready(() => {


// ------------------------- dialogs -------------------------------------

        const dialogs = new Dialogs({
            selector: ".dlg"
        });

// ------------------------- / dialogs ----------------------------------

        // get the various dom elements
        const mainElement = document.querySelector("#jtk-demo-flowchart"),
            canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
            miniviewElement = mainElement.querySelector(".miniview"),
            nodePalette = mainElement.querySelector(".node-palette"),
            controls = mainElement.querySelector(".controls");

        // Declare an instance of the Toolkit, and supply the functions we will use to get ids and types from nodes.
        const toolkit = newInstance({
            nodeFactory: (type:string, data:any, callback:Function) => {
                dialogs.show({
                    id: "dlgText",
                    title: "Enter " + type + " name:",
                    onOK:  (d:any) => {
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
                })

                return true
            },
            beforeStartConnect:(node:Vertex, edgeType:string) => {
                // limit edges from start node to 1. if any other type of node, return a payload for the edge.
                // if there is already a label set for the edge (say, if it was connected programmatically or via
                // edge undo/redo), this label is ignored.
                return (node.data.type === "start" && node.getEdges().length > 0) ? false : { label:"..." }
            }
        })

// ------------------------ / toolkit setup ------------------------------------

// ------------------------ rendering ------------------------------------

        const _editLabel = (edge:Edge, deleteOnCancel?:boolean) => {
            dialogs.show({
                id: "dlgText",
                data: {
                    text: edge.data.label || ""
                },
                onOK: (data:any) => {
                    toolkit.updateEdge(edge, { label:data.text || "" })
                },
                onCancel:() => {
                    if (deleteOnCancel) {
                        toolkit.removeEdge(edge)
                    }
                }
            })
        }

        // Instruct the toolkit to render to the 'canvas' element. We pass in a view of nodes, edges and ports, which
        // together define the look and feel and behaviour of this renderer.  Note that we can have 0 - N renderers
        // assigned to one instance of the Toolkit..
        const renderer:Surface = toolkit.render({
            container: canvasElement,
            view: {
                nodes: {
                    "start": {
                        template: "tmplStart"
                    },
                    "selectable": {
                        events: {
                            click: (params:{obj:Vertex}) => {
                                toolkit.toggleSelection(params.obj);
                            }
                        }
                    },
                    "question": {
                        parent: "selectable",
                        template: "tmplQuestion"
                    },
                    "action": {
                        parent: "selectable",
                        template: "tmplAction"
                    },
                    "output":{
                        parent:"selectable",
                        template:"tmplOutput"
                    }
                },
                // There are two edge types defined - 'yes' and 'no', sharing a common
                // parent.
                edges: {
                    "default": {
                        editable:true,
                        anchor:"AutoDefault",
                        endpoint:"Blank",
                        connector: {type:"Orthogonal", options:{ cornerRadius: 3 } },
                        paintStyle: { strokeWidth: 2, stroke: "rgb(132, 172, 179)", outlineWidth: 3, outlineStroke: "transparent" },	//	paint style for this edge type.
                        hoverPaintStyle: { strokeWidth: 2, stroke: "rgb(67,67,67)" }, // hover paint style for this edge type.
                        events: {
                            click:(p:any) => {
                                edgeEditor.startEditing(p.edge, {
                                    deleteButton:true,
                                    onMaybeDelete:(edge:Edge, connection:Connection, doDelete:Function) => {
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
                                type: "Label", options: {
                                    label: "${label}",
                                    events: {
                                        click: (params:any) => {
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
                canvasClick: (e:Event) => {
                    toolkit.clearSelection();
                    edgeEditor.stopEditing();
                },
                edgeAdded:(params:any) => {
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
                { type: MiniviewPlugin.type, options: {container: miniviewElement } },
                DrawingToolsPlugin.type
            ]
        } as SurfaceRenderOptions);

        const edgeEditor = new EdgePathEditor(renderer);

        new ToolkitSyntaxHighlighter(toolkit, ".jtk-demo-dataset");

        const undoredo = new Manager({
            surface:renderer,
            onChange:(undo:any, undoSize:number, redoSize:number) => {
                controls.setAttribute("can-undo", undoSize > 0 ? "true" : "false");
                controls.setAttribute("can-redo", redoSize > 0 ? "true" : "false");
            },
            compound:true
        });

        renderer.on(controls, EVENT_TAP, "[undo]",  () => {
            undoredo.undo();
        })

        renderer.on(controls, EVENT_TAP, "[redo]", () => {
            undoredo.redo();
        })

        // Load the data.
        toolkit.load({
            url: "../data/copyright.json",
            onload:function() {
                renderer.zoomToFit()
            }
        })

        // listener for mode change on renderer.
        renderer.bind("modeChanged", (mode:string) => {
            forEach(controls.querySelectorAll("[mode]"), (e:Element) => {
                renderer.removeClass(e, "selected-mode")
            })

            renderer.addClass(controls.querySelector("[mode='" + mode + "']"), "selected-mode")
        })

        // pan mode/select mode
        renderer.on(controls, EVENT_TAP, "[mode]", (e:Event) => {
            //renderer.setMode(this.getAttribute("mode"));
        });

        // on home button click, zoom content to fit.
        renderer.on(controls, EVENT_TAP, "[reset]",  () => {
            toolkit.clearSelection();
            renderer.zoomToFit();
        });

        // on clear button, perhaps clear the Toolkit
        renderer.on(controls, EVENT_TAP, "[clear]", () => {
            if (toolkit.getNodeCount() === 0 || confirm("Clear flowchart?")) {
                toolkit.clear();
            }
        });

        //
        // node delete button.
        //
        renderer.on(canvasElement, "click", ".node-delete",  (e:Event) => {
            const info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement)
            dialogs.show({
                id: "dlgConfirm",
                data: {
                    msg: "Delete '" + info.obj.data.text + "'"
                },
                onOK: function () {
                    toolkit.removeNode(info.obj)
                }
            })
        })

        // change a question or action's label
        renderer.on(canvasElement, EVENT_TAP, ".node-edit", (e:Event) => {
            // getObjectInfo is a method that takes some DOM element (this function's `this` is
            // set to the element that fired the event) and returns the toolkit data object that
            // relates to the element. it ascends through parent nodes until it finds a node that is
            // registered with the toolkit.
            const info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement)
            dialogs.show({
                id: "dlgText",
                data: info.obj.data,
                title: "Edit " + info.obj.data.type + " name",
                onOK: (data:any) => {
                    if (data.text && data.text.length > 2) {
                        // if name is at least 2 chars long, update the underlying data and
                        // update the UI.
                        toolkit.updateNode(info.obj, data)
                    }
                }
            })
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

        createSurfaceManager({
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
        registerHandler(renderer, "jsplumb-demo-print");

})


figma.showUI(__html__, { width: 800, height: 800 });

figma.ui.onmessage = async (msg) => {
    
    if (msg.type === "analyze-prompt") {

        const promptText = msg.prompt;
        const response = await analyzePrompt(promptText);
        console.log("rishabh" + response);
        figma.ui.postMessage({ type: "prompt-analysis", data: response });
    }
};

figma.on("selectionchange", async () => {
    console.log("hey trying it for drawing");
    if (figma.currentPage.selection.length > 0) {
        const selectedNode = figma.currentPage.selection[0]; // Get the first selected node
        console.log("Selected Node ID:", selectedNode.id);

        const nodeId = selectedNode.id;

        const FILE_KEY = "";
        //const ACCESS_TOKEN = "";
        const url = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${nodeId}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Figma-Token": ACCESS_TOKEN
            }
        });
    
        const data = await response.json();
        console.log("hey");
        
        console.log("Figma Node Data:", JSON.stringify(data, null, 2));
        extractLwcData(data);



    }
});

async function analyzePrompt(prompt) {
    const API_URL = "https://api.openai.com/v1/chat/completions";
    //const API_KEY = "";
    //console.log(prompt);
    //const API_URL = "https://bot-svc-llm.sfproxy.einsteintest1.test1-uswest2.aws.sfdc.cl/v1/chat/completions";
    //const API_KEY = "651192c5-37ff-440a-b930-7444c69f4422";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4",
            messages: [{ 
                role: "user", 
                content: `Based on the following UI requirement, suggest the best Salesforce Lightning Design System (SLDS) components. 
                Return the response strictly as a JSON array of objects in the format:
                [
                    {
                        "component_name": "SLDS Component Name",
                        "description": "Brief description of why this component is suggested"
                    }
                ]
         
                Requirement: ${prompt}`
            }],
            max_tokens: 300,
        })
        
    });

    //console.log(response);
    const data = await response.json();
   
    
    if (!response.ok) {
        console.error("Error:", data);
        return `Error: ${data.error.message || "Something went wrong"}`;
    }
    const jsonData = JSON.parse(data.choices[0].message.content);

    //console.log(jsonData[0]);
    generateLayout(jsonData);
    //console.log()
    return data.choices[0].message.content;
}

async function generateLayout(layoutData) {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    let yPosition = 100; // Fixed starting Y coordinate
    let xPosition = 100; // Fixed starting X coordinate
    const spacing = 80;  // More space between components

    layoutData.forEach(component => {
        let node, textLabel;

        if (component.component_name === "Input" || component.component_name === "SLDS Input") {
            // **Label (Text above Input Box)**
            textLabel = figma.createText();
            textLabel.characters = "Enter some text";
            textLabel.fontSize = 30; // Adjusted font size
            textLabel.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
            textLabel.x = xPosition;
            textLabel.y = yPosition;

            // **Input Field (Rectangle)**
            node = figma.createRectangle();
            node.resize(500, 100); // Bigger Input Box (Width: 500, Height: 100)
            node.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White Background
            node.strokes = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }]; // Gray Border
            node.cornerRadius = 6; // More rounded edges
            node.name = "SLDS Input Field";
            node.x = xPosition;
            node.y = yPosition + 50; // **Increased gap between text and input box**

            // Group elements together
            let group = figma.group([node, textLabel], figma.currentPage);
            figma.currentPage.appendChild(group);

            yPosition += node.height + spacing; // Adjust for next element
        }
    });

    // Adjust viewport to focus on created elements
    //figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
}


function extractLwcData(figmaJson) {
    //let lwcData = [];

    function getColor(colorObj) {
        return colorObj
            ? `rgba(${Math.round((colorObj.r || 0) * 255)}, 
                    ${Math.round((colorObj.g || 0) * 255)}, 
                    ${Math.round((colorObj.b || 0) * 255)}, 
                    ${colorObj.a !== undefined ? colorObj.a : 1})`
            : 'transparent';
    }

    function processNode(node) {
        if (!node || !node.document) return;

        let component = node.document;
        let componentData = { name: component.name || "Unnamed", type: component.type || "UNKNOWN" };

        if (component.absoluteBoundingBox) {
            componentData.width = component.absoluteBoundingBox.width;
            componentData.height = component.absoluteBoundingBox.height;
        }

        if (Array.isArray(component.fills) && component.fills.length > 0 && component.fills[0].color) {
            componentData.backgroundColor = getColor(component.fills[0].color);
        }

        if (Array.isArray(component.strokes) && component.strokes.length > 0 && component.strokes[0].color) {
            componentData.borderColor = getColor(component.strokes[0].color);
        }

        if (component.strokeWeight !== undefined) {
            componentData.borderWidth = component.strokeWeight;
        }

        if (component.cornerRadius !== undefined) {
            componentData.borderRadius = component.cornerRadius;
        }

        if (component.characters) {
            componentData.text = component.characters;
        }

        if (component.style) {
            if (component.style.fontSize !== undefined) {
                componentData.fontSize = component.style.fontSize;
            }
            if (component.style.fontWeight !== undefined) {
                componentData.fontWeight = component.style.fontWeight;
            }
            if (component.style.textAlignHorizontal) {
                componentData.textAlign = component.style.textAlignHorizontal.toLowerCase();
            }
        }

        if (Array.isArray(component.children) && component.children.length > 0) {
            componentData.children = component.children
                .map(child => processNode({ document: child }))
                .filter(child => child !== null);
        }

        return componentData;
    }
    let lwcData = Object.values(figmaJson.nodes)
        .map(processNode)
        .filter(component => component !== null);

    console.log(lwcData);
    console.log(JSON.stringify(lwcData, null, 2));
    helper(JSON.stringify(lwcData, null, 2));
}


async function helper(prompt)
{
    const API_URL = "https://api.openai.com/v1/chat/completions";
    //const API_KEY = "";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4",
            messages: [{ 
                role: "user", 
                content: `Based on the below structured format, create the LWC code containing HTML and CSS code only and strictly use the LWC components. Do utilise the SLDS classes for most of the styling.
                Requirement: ${prompt}`
            }],
            max_tokens: 300,
        })
        
    });

    //console.log(response);
    const data = await response.json();
    console.log("API Response Data:", JSON.stringify(data, null, 2));

    console.log("rishabh" + data.choices[0].message.content);
    //generateLayout(data);

    console.log("abcdefgh");
    
    if (!response.ok) {
        console.error("Error:", data);
        return `Error: ${data.error.message || "Something went wrong"}`;
    }
    //console.log("rishabh"+ typeof data.choices[0].message.content);
    const jsonData = JSON.parse(data.choices[0].message.content);
    console.log("aditi");

    console.log("rishabh" + jsonData.choices.message.content);
}





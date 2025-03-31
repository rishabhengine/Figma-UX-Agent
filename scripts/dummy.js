const cheerio = require("cheerio");
const fs = require("fs");

// Read LWC HTML & CSS files
const lwcHtml = fs.readFileSync("sampleComponent.html", "utf-8");
const lwcCss = fs.readFileSync("sampleComponent.css", "utf-8");

// Load HTML into cheerio
const $ = cheerio.load(lwcHtml, { xmlMode: true });

// Parse CSS styles and map them to class names
function parseCss(cssContent) {
    const cssRules = {};
    const regex = /\.([\w-]+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = regex.exec(cssContent)) !== null) {
        const className = match[1]; // Extract class name
        const properties = match[2]
            .split(";")
            .map((prop) => prop.trim())
            .filter((prop) => prop);

        cssRules[className] = properties.reduce((acc, prop) => {
            const [key, value] = prop.split(":").map((s) => s.trim());
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {});
    }

    return cssRules;
}

const cssStyles = parseCss(lwcCss);

// Recursive function to parse elements and add styles
function parseElement(element) {
    let node = {
        tag: element.tagName,
        attributes: {},
        children: [],
        text: $(element).text().trim() || undefined,
        styles: {}
    };

    // Extract attributes (class, label, variant, etc.)
    Object.keys(element.attribs || {}).forEach((attr) => {
        node.attributes[attr] = element.attribs[attr];

        // If class exists, map CSS styles
        if (attr === "class") {
            const classNames = element.attribs[attr].split(" ");
            classNames.forEach((cls) => {
                if (cssStyles[cls]) {
                    node.styles = { ...node.styles, ...cssStyles[cls] };
                }
            });
        }
    });

    // Recursively process children
    $(element)
        .children()
        .each((_, child) => {
            node.children.push(parseElement(child));
        });

    return node;
}

// Convert the template to JSON
const jsonOutput = parseElement($("template").get(0));

// Save JSON output
fs.writeFileSync("lwc_output.json", JSON.stringify(jsonOutput, null, 2));

console.log("✅ LWC HTML & CSS converted to JSON successfully!");


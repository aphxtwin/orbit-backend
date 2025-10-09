/**
 * Render WhatsApp template (HEADER, BODY, FOOTER only)
 * @param {Array} components - Template components from Meta API
 * @param {Object} variables - Variables to fill (e.g., {1: "John", 2: "#12345"})
 * @returns {Object} { rawContent, renderedContent }
 */
function renderTemplate(components, variables) {
  const sections = ["HEADER", "BODY", "FOOTER"];
  const rawParts = [];
  const renderedParts = [];

  sections.forEach((type) => {
    const c = components.find((x) => x.type === type);
    if (!c?.text) return;

    const raw = c.text;
    let rendered = raw;

    Object.keys(variables).forEach((k) => {
      const i = parseInt(k);
      rendered = rendered.replace(new RegExp(`\\{\\{${i}\\}\\}`, "g"), variables[i] ?? "");
    });

    rawParts.push(raw);
    renderedParts.push(rendered);
  });

  return {
    rawContent: rawParts.join("\n\n"),
    renderedContent: renderedParts.join("\n\n"),
  };
}

module.exports = {
  renderTemplate
};

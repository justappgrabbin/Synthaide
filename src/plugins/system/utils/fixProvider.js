const { changeProvider } = require("./changeProvider");
module.exports = context => changeProvider(false, context);
if (require.main === module) changeProvider(false);

const { changeProvider } = require("./changeProvider");
module.exports = context => changeProvider(true, context);
if (require.main === module) changeProvider(true);

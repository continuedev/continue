const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

exec("npm install", (error) => {
  if (error) throw error;
  console.log("npm install completed");

  exec("npm run typegen", (error) => {
    if (error) throw error;
    console.log("npm run typegen completed");

    process.chdir("react-app");

    exec("npm install", (error) => {
      if (error) throw error;
      console.log("npm install in react-app completed");

      exec("npm run build", (error) => {
        if (error) {
          console.log("Error running npm run build in react-app: ", error);
          throw error;
        }
        if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
          throw new Error("react-app build did not produce index.js");
        }
        if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
          throw new Error("react-app build did not produce index.css");
        }
        console.log("npm run build in react-app completed");
      });
    });
  });
});

/*
  If your React application grows big you might want to consider
  splitting it into several SPAs, each rendered by its own and
  smaller script bundle. Since this solution is based on
  Crisp React, please see:
  https://winwiz1.github.io/crisp-react/#spa-configuration
*/

var ConfiguredSPAs = function () {
  function SPA(params) {
    this.params = params;
  }

  /****************** Start SPA Configuration ******************/
  var SPAs = [
    new SPA({
      name: "app",
      entryPoint: "./src/entrypoints/app.tsx",
      redirect: true
    })
  ];
  SPAs.appTitle = "Crisp BigQuery";
  /****************** End SPA Configuration ******************/

  SPAs.verifyParameters = function (verifier) {
    if (SPAs.length === 0) {
      throw new RangeError("At least one SPA needs to be configured");
    }

    SPAs.forEach(function (spa, idx) {
      spa.params = verifier(spa.params, idx);
    });

    var num = SPAs.reduce(function (acc, item) {
      return item.params.redirect ? acc + 1 : acc;
    }, 0);

    if (num !== 1) {
      throw new RangeError("One and only one SPA must have 'redirect: true'");
    }
  };

  SPAs.getEntrypoints = function () {
    var entryPoints = new Object();
    SPAs.forEach(spa => (entryPoints[spa.params.name] = spa.params.entryPoint));
    return entryPoints;
  };

  SPAs.getRedirectName = function () {
    return SPAs.find(spa => spa.params.redirect).params.name;
  };

  SPAs.getNames = function () {
    var spaNames = new Array();
    SPAs.forEach(spa => spaNames.push(spa.params.name));
    return spaNames;
  };

  SPAs.getRewriteRules = function () {
    var ret = new Array();
    SPAs.forEach(spa => {
      var rule = new Object();
      rule.from = new RegExp(`^/${spa.params.name}` + "(\\.html)?$");
      rule.to = `${spa.params.name}.html`;
      ret.push(rule);
    });
    ret.push({
      from: new RegExp("^.*$"),
      to: `/${SPAs.getRedirectName()}.html`
    });
    return ret;
  };

  return SPAs;
};

module.exports = ConfiguredSPAs();

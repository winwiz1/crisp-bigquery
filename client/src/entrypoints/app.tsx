import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Helmet } from "react-helmet";
import { QueryPageContainer } from "../components/QueryPageContainer";
import { rootStore } from "../state/store";
import { ErrorBoundary } from "../components/ErrorBoundary";
import * as SPAs from "../../config/spa.config";

ReactDOM.render(
  <Provider store={rootStore} >
    <ErrorBoundary>
      <Helmet title={SPAs.appTitle} />
      <QueryPageContainer  />
    </ErrorBoundary>
  </Provider>,
  document.getElementById("app-root")
);

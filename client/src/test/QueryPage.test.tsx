/**
 * QueryPage tests using React Testing Library
 * with Jest adaptors.
 */
import * as React from "react";
import { Provider } from "react-redux";
import { render, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { rootStore } from "../state/store";
import { QueryPageContainer } from "../components/QueryPageContainer";

describe("Testing QueryPageContainer", () => {
  // Demonstrates how to test static rendering
  test("Basic tests", async () => {
    const { getByText, getAllByText, queryByText } = render(
      <Provider store={rootStore}>
        <QueryPageContainer />
      </Provider>
    );

    getByText(content => content.startsWith("Query Options"));
    expect(queryByText("Not there", { exact: true, selector: "div" })).toBeNull();
    expect(getAllByText("Start Date", { exact: false, selector: "div" })[0]).toBeVisible();
    expect(getAllByText("End Date", { exact: false, selector: "div" })[0]).toBeVisible();
    expect(getAllByText("Repository Name", { exact: false, selector: "div" })[0]).toBeVisible();
    expect(getAllByText("Repository Language", { exact: false, selector: "div" })[0]).toBeVisible();
    expect(getByText("Paginated Results Table", { exact: false, selector: "div" })).toBeVisible();
    expect(getByText("Query Data", { exact: true, selector: "div" })).toBeVisible();
  });

  // Demonstrates how to test dynamic rendering, for example a toggle performed by the accordion.
  test("Test accordion", async () => {
    const { container } = render(
      <Provider store={rootStore}>
        <QueryPageContainer />
      </Provider>
    );

    // Find the accordion. See comments in
    // https://github.com/winwiz1/crisp-react/blob/master/client/src/test/Overview.test.tsx
    const cssAccordion = "main section div.accordion.ui div.active.title div";
    const accordion = container.querySelector(cssAccordion);
    // Check we found the correct one
    expect(accordion).toHaveTextContent("Query Options");

    // Find the 'Start Date' label
    const cssStartDateVisible = "main section div.accordion.ui div.content.active" +
      " div.ui.raised.segment.blurring.dimmable section div.ui.basic.segment div";
    let labelStartDate = container.querySelector(cssStartDateVisible);
    // Check we found the correct one
    expect(labelStartDate).toHaveTextContent("Start Date");

    // Toggle the accordion
    const leftClick = { button: 0 };
    act(() => {
      fireEvent.click(accordion!, leftClick);
    });

    // Check the toggle
    labelStartDate = container.querySelector(cssStartDateVisible);
    expect(labelStartDate).toBeNull();
    const cssStartDateHidden = cssStartDateVisible.replace(/\.active/, "");
    labelStartDate = container.querySelector(cssStartDateHidden);
    expect(labelStartDate).toHaveTextContent("Start Date");
  });
});

/*
 * QueryInput allows a user to input query parameters
 */
import * as React from "react";
import * as moment from "moment";
import { style, classes } from "typestyle";
import {
  Button,
  Dimmer,
  Divider,
  Icon,
  Accordion,
  AccordionTitleProps,
  Segment,
  Loader,
  Input,
  InputOnChangeData,
} from "semantic-ui-react";
import DayPicker, { DayModifiers } from "react-day-picker";
import "react-day-picker/lib/style.css";
import { IBackendRequestData, BackendRequest } from "../api/BackendRequest";
import { BackendManager} from "../api/BackendManager";

//#region Styles

const cssAccordionHeader = style({
  display: "inline-block",
  fontSize: "1.33em",
  fontWeight: "bold",
  marginBottom: "0.5em",
  marginLeft: "0",
  marginRight: "0",
  marginTop: "1em"
});
const cssFlexContainer = style({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  width: "100vw"
});
const cssFlexItem = style({
  flex: "1 0 auto",
  marginTop: "1rem !important"
});
const cssFlexItemHeader = style({
  display: "block",
  fontSize: "1.17em",
  fontWeight: "bold",
  marginBottom: "1em",
  marginTop: "0"
});
const cssMarginLeft = style({
  marginLeft: "25px"
});
const cssInputFootnote = style({
  marginTop: "1em",
  overflow: "hidden",
  width: "20ch"
});
const cssUserFootnote = style({
  marginTop: "1em",
  overflow: "hidden",
  width: "27ch"
});

//#endregion

// The shape of QueryInput properties
interface IAuditQueryProps {
    inFlight: boolean;
    performQuery: (request: IBackendRequestData) => Promise<void>;
    className: string;
}

/*
  QueryInput component
*/
export const QueryInput: React.FunctionComponent<IAuditQueryProps> = props => {
  const maxQueryDurationDays = BackendRequest.MaxQueryDuration;
  const errMsg = "Unexpected query parameters, please contact Support.";

  // Pagination count
  const initialCount = { value: 100, error: false};
  const [count, setCount] = React.useState<typeof initialCount>(initialCount);
  const onCountChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    const result = Number.parseInt(data.value, 10);
    if (result) {
      setCount({ value: result, error: !(result > 0 && result <= 2000)});
    } else {
      setCount({ value: 0, error: true});
    }
  };

  // The start of query timeframe
  const initialDate = new Date("2012-03-25");
  initialDate.setHours(0, 0, 0, 0);
  const [startDate, setStartDate] = React.useState<Date|undefined>(initialDate);
  const handleStartDate = (date: Date, { selected, disabled }: DayModifiers) => {
    if (disabled) {
      return;
    }
    if (selected) {
      setStartDate(undefined);
      setEndDate(undefined);
      return;
    }
    date.setHours(0, 0, 0, 0);
    setStartDate(date);
    setEndDate(undefined);
  };

  // The end of query timeframe
  const [endDate, setEndDate] = React.useState<Date|undefined>(initialDate);
  const handleEndDate = (date: Date, { selected, disabled }: DayModifiers) => {
    if (disabled) {
      return;
    }
    if (selected) {
      setEndDate(undefined);
      return;
    }
    date.setHours(0, 0, 0, 0);
    setEndDate(date);
  };

  // Filter by repository name
  const [name, setName] = React.useState<string|undefined>(undefined);
  const onNameChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    setName(data.value);
  };

  // Filter by repository language
  const [language, setLanguage] = React.useState<string|undefined>(undefined);
  const onLanguageChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    // console.log(data);
    setLanguage(data.value);
  };

  // Accordion handling
  const [accordionActive, setAccordionActive] = React.useState(true);
  const handleAccordion = (_evt: React.MouseEvent<HTMLDivElement, MouseEvent>, _data: AccordionTitleProps) => {
    setAccordionActive(!accordionActive);
  };

  // Helper method to get a request for backend
  const getRequest = (): IBackendRequestData => {
    if (!startDate || !endDate || count.value === 0 || count.error) {
      // Can only happen if code is incorrectly modified
      throw TypeError(errMsg);
    }
    return {
      endDate,
      language,
      name,
      rowCount: count.value,
      startDate
    };
  };

  // Event handler
  const onQuery = async () => {
    const req = getRequest();
    await props.performQuery(req);
  };

  // Client side checks to prevent invalid requests
  function isNameValid(nameToCheck: string|undefined): boolean {
    return !!nameToCheck ? BackendManager.RegexName.test(nameToCheck) : true;
  }
  function isLanguageValid(languageToCheck: string|undefined): boolean {
    return !!languageToCheck ? BackendManager.RegexLanguage.test(languageToCheck) : true;
  }

  return (
    <section className={props.className}>
        <Accordion>
          <Accordion.Title active={accordionActive} onClick={handleAccordion}>
            <Icon name="dropdown" />
            <div className={cssAccordionHeader}>Query Options</div>
          </Accordion.Title>
          <Accordion.Content active={accordionActive}>
            <Dimmer.Dimmable as={Segment} blurring raised>
              <Dimmer active={props.inFlight}>
                <Loader>Loading backend data</Loader>
              </Dimmer>
            <section className={cssFlexContainer}>

              <Segment basic className={cssFlexItem}>
                <div className={classes(cssFlexItemHeader, cssMarginLeft)}>
                  Start Date
                </div>
                <DayPicker
                  onDayClick={handleStartDate}
                  selectedDays={startDate}
                  firstDayOfWeek={0}
                  disabledDays={[{ after: new Date("2012-05-02"),
                                   before: new Date("2012-03-10") }]}
                  month={startDate ?? initialDate}
                  initialMonth={startDate}
                />

                {!!startDate ? (
                  <div className={cssMarginLeft}>
                    Start date: {startDate.toLocaleDateString("en-US", { hour12: false })}
                    <br />
                    Clicking again will deselect.
                  </div>
                ) : (
                  <div className={cssMarginLeft}>
                    Please select start date.
                    <br />
                    Dates outside the dateset range are grayed/disabled.
                  </div>
                )}
              </Segment>

              <Segment basic className={cssFlexItem} disabled={!startDate}>
                <div className={classes(cssFlexItemHeader, cssMarginLeft)}>
                  End Date
                </div>
                <DayPicker
                  onDayClick={handleEndDate}
                  selectedDays={endDate}
                  firstDayOfWeek={0}
                  disabledDays={{
                    after: moment(startDate).add(maxQueryDurationDays, "days").toDate(),
                    before: startDate
                  }}
                  initialMonth={startDate}
                  month={startDate}
                />

                {!!endDate ? (
                  <div className={cssMarginLeft}>
                    End date: {endDate.toLocaleDateString("en-US", { hour12: false })}
                    <br />
                    Clicking again will deselect.
                  </div>
                ) : (
                  <div className={cssMarginLeft}>
                    Please select end date.
                    <br />
                    Maximum query duration is 1 week.
                  </div>
                )}
              </Segment>

              <Segment compact basic className={cssFlexItem}>
                <div className={cssFlexItemHeader}>Repository Name</div>
                <Input
                  type="text"
                  maxLength="32"
                  focus
                  style={{ width: "27ch" }}
                  error={!isNameValid(name)}
                  onChange={onNameChange}
                />
                <div className={cssUserFootnote}>
                  Optional. Case sensitive.
                  <br />
                  Restrict query to repository names starting with this pattern.
                </div>
              </Segment>

              <Segment compact basic className={cssFlexItem}>
                <div className={cssFlexItemHeader}>Repository Language</div>
                <Input
                  type="text"
                  maxLength="64"
                  focus
                  style={{ width: "27ch" }}
                  error={!isLanguageValid(language)}
                  onChange={onLanguageChange}
                />
                <div className={cssUserFootnote}>
                  Optional. Case sensitive.
                  <br />
                  Restrict query to repository languages starting with this pattern.
                </div>
              </Segment>

              <Segment compact basic className={cssFlexItem}>
                <div className={cssFlexItemHeader}>Paginated Results Table</div>
                <Input
                  type="number"
                  min="100"
                  max="2000"
                  placeholder="100"
                  onChange={onCountChange}
                  label={"rows per page"}
                  labelPosition="right"
                  step="100"
                  error={count.error}
                />
                <div className={cssInputFootnote}>
                  Default = 100
                  <br />
                  Maximum = 2000
                </div>
              </Segment>

            </section>

            <Button
              floated="right"
              color="blue"
              disabled={!startDate || !endDate || count.value === 0 ||
                        count.error || !isNameValid(name) || !isLanguageValid(language)}
              onClick={onQuery}
            >
              <Icon name="cloud download" />
              Run query
            </Button>

            <Divider hidden clearing fitted />
            </Dimmer.Dimmable>
          </Accordion.Content>
        </Accordion>
    </section>
  );
};

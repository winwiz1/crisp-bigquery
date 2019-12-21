/*
 * QueryInput allows a user to input query parameters
 */
import * as React from "react";
import * as moment from "moment";
import { style, classes } from "typestyle";
import {
  Button,
  Checkbox,
  CheckboxProps,
  Dimmer,
  Divider,
  Icon,
  Accordion,
  AccordionTitleProps,
  Segment,
  Loader,
  Input,
  InputOnChangeData,
  Popup
} from "semantic-ui-react";
import DayPicker, { DayModifiers } from "react-day-picker";
import "react-day-picker/lib/style.css";
import { IBackendRequestData, BackendRequest } from "../api/BackendRequest";
import { BackendManager } from "../api/BackendManager";

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
const cssButtonQuery = style({
  width: "18ch"
});
const cssPaginationCheckbox = style({
  marginBottom: "0.5em",
  marginTop: "0.5em",
});

//#endregion

// The shape of QueryInput properties
interface IAuditQueryProps {
  inFlight: boolean;
  autoPaginate: (request: IBackendRequestData) => void;
  performQuery: (request: IBackendRequestData) => Promise<void>;
  className: string;
}

/*
  QueryInput component
*/
export const QueryInput: React.FunctionComponent<IAuditQueryProps> = props => {
  const maxQueryDurationDays = BackendRequest.MaxQueryDuration;
  const errMsg = "Unexpected query parameters, please contact Support.";

  // Pagination: row count
  const rowCountDefault = 100;
  const rowCountMax = 2000;
  const initialRowCount = { value: rowCountDefault, error: false };
  const [rowCount, setRowCount] = React.useState<typeof initialRowCount>(initialRowCount);
  const onRowCountChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    const result = Number.parseInt(data.value, 10);
    if (result) {
      setRowCount({ value: result, error: !(result > 0 && result <= rowCountMax) });
    } else {
      setRowCount({ value: 0, error: true });
    }
  };

  // The start of query timeframe
  const initialDate = new Date("2012-03-25");
  initialDate.setHours(0, 0, 0, 0);
  const [startDate, setStartDate] = React.useState<Date | undefined>(initialDate);
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
  const [endDate, setEndDate] = React.useState<Date | undefined>(initialDate);
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
  const [name, setName] = React.useState<string | undefined>(undefined);
  const onNameChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    setName(data.value);
  };

  // Filter by repository language
  const [language, setLanguage] = React.useState<string | undefined>(undefined);
  const onLanguageChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    // console.log(data);
    setLanguage(data.value);
  };

  // Accordion handling
  const [accordionActive, setAccordionActive] = React.useState(true);
  const handleAccordion = (_evt: React.MouseEvent<HTMLDivElement, MouseEvent>, _data: AccordionTitleProps) => {
    setAccordionActive(!accordionActive);
  };

  // Auto-pagination
  const [autoPaginate, setAutoPaginate] = React.useState(false);
  const onAutoPaginateChange = (_evt: React.FormEvent<HTMLInputElement>, data: CheckboxProps) => {
    const result = !!data.checked;
    setAutoPaginate(result);
  };

  // Helper method to get a request for backend
  const getRequest = (): IBackendRequestData => {
    if (!startDate || !endDate || rowCount.value === 0 || rowCount.error) {
      // Can only happen if code is incorrectly modified
      throw TypeError(errMsg);
    }
    return {
      endDate,
      language,
      name,
      rowCount: rowCount.value,
      startDate
    };
  };

  // Event handler
  const onQuery = async () => {
    const req = getRequest();

    if (autoPaginate) {
      props.autoPaginate(req);
    } else {
      await props.performQuery(req);
    }
  };

  // Client side checks to prevent invalid requests
  function isNameValid(nameToCheck: string | undefined): boolean {
    return !!nameToCheck ? BackendManager.RegexName.test(nameToCheck) : true;
  }
  function isLanguageValid(languageToCheck: string | undefined): boolean {
    return !!languageToCheck ? BackendManager.RegexLanguage.test(languageToCheck) : true;
  }

  const csvBtnTooltip = autoPaginate ?
    "Open the Auto-pagination dialog to set the desired number of data pages." :
    "Run new query. Already fetched data (if any) will be discarded.";

  return (
    <section className={props.className}>
      <Accordion>
        <Accordion.Title active={accordionActive} onClick={handleAccordion}>
          <Icon name="dropdown" />
          <Popup
            content={"Click to toggle collapse"}
            trigger={
              <div className={cssAccordionHeader}>Query Options</div>
            }
          />
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
                  disabledDays={[{
                    after: new Date("2012-05-02"),
                    before: new Date("2012-03-10")
                  }]}
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
                <div>
                  <div className={cssFlexItemHeader}>Paginated Results Table</div>
                  <Input
                    type="number"
                    min={rowCountDefault}
                    max={rowCountMax}
                    placeholder={rowCountDefault}
                    onChange={onRowCountChange}
                    label={"rows per page"}
                    labelPosition="right"
                    step={rowCountDefault}
                    error={rowCount.error}
                  />
                  <div className={cssInputFootnote}>
                    {`Default = ${rowCountDefault}`}
                    <br />
                    {`Maximum = ${rowCountMax}`}
                  </div>
                </div>
                &nbsp;
                <Segment compact>
                  <div className={cssPaginationCheckbox}>
                    <Checkbox
                      checked={autoPaginate}
                      toggle
                      label="Auto-paginate"
                      onChange={onAutoPaginateChange}
                    />
                  </div>
                </Segment>
              </Segment>

            </section>

            <Popup
              content={csvBtnTooltip}
              trigger={
                <Button
                  className={cssButtonQuery}
                  floated="right"
                  color="blue"
                  disabled={!startDate || !endDate ||
                    rowCount.value === 0 || rowCount.error ||
                    !isNameValid(name) || !isLanguageValid(language)
                  }
                  onClick={onQuery}
                >
                  <Icon name={autoPaginate ? "forward" : "cloud download"} />
                  {autoPaginate ? "Paginate" : "New query"}
                </Button>
              }
            />
            <Divider hidden clearing fitted />
          </Dimmer.Dimmable>
        </Accordion.Content>
      </Accordion>
    </section>
  );
};

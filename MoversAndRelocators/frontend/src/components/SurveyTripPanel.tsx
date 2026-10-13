import { surveysApi } from '../api'
import type { Employee, SurveyDetail } from '../types'
import { AiSpendCard } from './AiSpendCard'
import { ExpensesCard } from './ExpensesCard'
import { TripClockCard } from './TripClockCard'

type Props = { detail: SurveyDetail; employees: Employee[]; onUpdated: (detail: SurveyDetail) => void }

/** Survey trip clock (leave office → pause/resume → back at office), distance, surveyor and travel expenses. */
export function SurveyTripPanel({ detail, employees, onUpdated }: Props) {
  const { survey, trip } = detail
  const employeeOptions = employees.filter(x => x.isActive || x.id === trip.conductedByEmployeeId).map(x => ({ value: x.id, label: `${x.fullName} · ${x.employeeNumber}` }))
  const update = async (result: Promise<SurveyDetail>) => onUpdated(await result)

  return <>
    <TripClockCard noun="survey" startedAtUtc={survey.startedAtUtc} endedAtUtc={survey.endedAtUtc} isPaused={trip.isPaused} events={trip.events} distanceKm={trip.distanceKm}
      conductedBy={{ label: 'Conducted by', value: trip.conductedByEmployeeId ?? survey.assignedEmployeeId, display: trip.conductedByName ?? <span className="is-empty">{survey.assignedEmployeeName} (assigned)</span>, options: employeeOptions }}
      onStart={at => update(surveysApi.start(survey.id, at))}
      onPause={(reason, at) => update(surveysApi.pause(survey.id, reason, at))}
      onResume={at => update(surveysApi.resume(survey.id, at))}
      onComplete={x => update(surveysApi.complete(survey.id, { at: x.at, distanceKm: x.distanceKm, conductedByEmployeeId: x.conductedByEmployeeId ?? survey.assignedEmployeeId }))}
      onEdit={x => update(surveysApi.updateTrip(survey.id, x))} />
    <ExpensesCard receiptKind="SURVEY" title="Survey expenses" expenses={trip.expenses} totals={trip.expenseTotals} employeeOptions={employeeOptions} defaultPaidBy={trip.conductedByEmployeeId ?? survey.assignedEmployeeId}
      emptyText="No expenses recorded. Add fuel, transport, metro, bus, toll or parking costs from the survey. They go to Accountant posting for the ledger."
      onSave={(input, existing) => update(existing ? surveysApi.updateExpense(survey.id, existing.id, input) : surveysApi.addExpense(survey.id, input))}
      onDelete={expense => update(surveysApi.deleteExpense(survey.id, expense.id))} />
    <AiSpendCard spend={detail.leadAiSpend} context="survey" />
  </>
}

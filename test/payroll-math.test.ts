import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  computePayrollRow,
  computeMonthStats,
  type AttendanceRecord,
  type Employee,
  type LeaveRequest,
  POLICY,
} from "../lib/attendance-data.ts"

// Mock employee with ₹1,20,000 monthly salary
const testEmployee: Employee = {
  id: "emp-test-01",
  name: "Test Employee",
  email: "test@acme.co",
  department: "Engineering",
  designation: "Engineer",
  managerId: "mgr-01",
  baseRole: "employee",
  monthlySalary: 120000,
}

// August 2026 period: Aug 1 to Aug 31
// Standard working days in Aug 2026: Mon-Fri minus Independence Day (Aug 15 is Saturday anyway)
// Let's create helper to generate records
function makeRecords(
  empId: string,
  schedule: Record<string, "present" | "wfh" | "late" | "half-day" | "leave" | "absent" | "weekend" | "holiday">,
): AttendanceRecord[] {
  return Object.entries(schedule).map(([date, status]) => ({
    id: `${empId}-${date}`,
    employeeId: empId,
    date,
    status,
    checkIn: status === "present" ? "09:00" : status === "late" ? "09:30" : null,
    checkOut: status === "present" ? "18:00" : status === "late" ? "18:30" : null,
    workedHours: status === "present" || status === "late" ? 8 : status === "half-day" ? 4 : 0,
    lateMinutes: status === "late" ? 30 : 0,
  }))
}

describe("Payroll Statutory Math & Policy Rules", () => {
  describe("Rule 1: Full Attendance & Base Computation", () => {
    it("computes 100% payable days and full salary with no deductions", () => {
      // 5 working days, all present
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "present",
        "2026-08-04": "present",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
        "2026-08-08": "weekend",
        "2026-08-09": "weekend",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-09")

      assert.equal(row.workingDays, 5, "Working days excludes weekends")
      assert.equal(row.payableDays, 5, "All 5 working days are payable")
      assert.equal(row.lopDays, 0, "No loss of pay")
      assert.equal(row.lateMarks, 0, "Zero late marks")
      assert.equal(row.lateDeductionDays, 0, "Zero late deduction days")

      // Per day rate: 120000 / 5 = 24000
      assert.equal(row.perDay, 24000)
      assert.equal(row.netAttendancePay, 120000, "Full gross salary payable")
    })
  })

  describe("Rule 2: Late Arrival Penalty (3 late marks = 0.5 day LOP)", () => {
    it("applies no salary deduction for 1 or 2 late marks", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "late",
        "2026-08-04": "late",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.lateMarks, 2)
      assert.equal(row.lateDeductionDays, 0, "No deduction for < 3 late marks")
      assert.equal(row.payableDays, 5)
      assert.equal(row.lateDeductionAmt, 0)
    })

    it("deducts exactly 0.5 day salary when threshold of 3 late marks is reached", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "late",
        "2026-08-04": "late",
        "2026-08-05": "late",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.lateMarks, 3)
      assert.equal(row.lateDeductionDays, 0.5, "Exactly 0.5 day deducted for 3 late marks")
      assert.equal(row.payableDays, 4.5, "Payable days reduced by 0.5")

      // Per day: 24,000. Deduction: 12,000. Net: 4.5 * 24000 = 108,000
      assert.equal(row.lateDeductionAmt, 12000)
      assert.equal(row.netAttendancePay, 108000)
    })

    it("deducts 1.0 day salary for 6 late marks (2 tiers of 3)", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "late",
        "2026-08-04": "late",
        "2026-08-05": "late",
        "2026-08-06": "late",
        "2026-08-07": "late",
        "2026-08-10": "late",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-10")
      assert.equal(row.lateMarks, 6)
      assert.equal(row.lateDeductionDays, 1.0, "1.0 day deducted for 6 late marks")
    })
  })

  describe("Rule 3: Half-Day Attendance", () => {
    it("counts half-day as 0.5 payable and 0.5 Loss of Pay (LOP)", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "half-day",
        "2026-08-04": "present",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.payableDays, 4.5)
      assert.equal(row.lopDays, 0.5)
      assert.equal(row.netAttendancePay, Math.round(row.perDay * 4.5))
    })
  })

  describe("Rule 4: Absence & Loss of Pay", () => {
    it("deducts full payable day for each unexcused absence", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "absent",
        "2026-08-04": "absent",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.lopDays, 2.0)
      assert.equal(row.payableDays, 3.0)
    })
  })

  describe("Rule 5: Paid Leave vs Leave Without Pay (LWP)", () => {
    it("treats approved paid leave as 1.0 payable day", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "leave",
        "2026-08-04": "present",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      // Paid casual leave request
      const leaves: LeaveRequest[] = [
        {
          id: "lv-01",
          employeeId: "emp-test-01",
          type: "casual",
          from: "2026-08-03",
          to: "2026-08-03",
          days: 1,
          reason: "Personal",
          state: "approved",
          submittedAt: "2026-08-01T00:00:00",
        },
      ]

      const row = computePayrollRow(records, leaves, testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.paidLeaveDays, 1)
      assert.equal(row.unpaidLeaveDays, 0)
      assert.equal(row.lopDays, 0)
      assert.equal(row.payableDays, 5, "Paid leave is payable")
    })

    it("deducts payable day for approved Leave Without Pay (LWP)", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "leave",
        "2026-08-04": "present",
        "2026-08-05": "present",
        "2026-08-06": "present",
        "2026-08-07": "present",
      })

      // Unpaid LWP request
      const leaves: LeaveRequest[] = [
        {
          id: "lv-02",
          employeeId: "emp-test-01",
          type: "unpaid",
          from: "2026-08-03",
          to: "2026-08-03",
          days: 1,
          reason: "Personal unpaid leave",
          state: "approved",
          submittedAt: "2026-08-01T00:00:00",
        },
      ]

      const row = computePayrollRow(records, leaves, testEmployee, "2026-08-03", "2026-08-07")
      assert.equal(row.paidLeaveDays, 0)
      assert.equal(row.unpaidLeaveDays, 1)
      assert.equal(row.lopDays, 1, "LWP is loss of pay")
      assert.equal(row.payableDays, 4, "Payable days reduced by unpaid leave")
    })
  })

  describe("Rule 6: Complex Multi-Factor Payroll Simulation", () => {
    it("accurately computes combined present, WFH, late marks, half-days, absences, and LWP", () => {
      // 10 working days total
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "present",
        "2026-08-04": "present",
        "2026-08-05": "wfh",
        "2026-08-06": "wfh",
        "2026-08-07": "late",
        "2026-08-10": "late",
        "2026-08-11": "late", // 3rd late mark -> triggers 0.5 day deduction
        "2026-08-12": "half-day", // 0.5 LOP
        "2026-08-13": "absent", // 1.0 LOP
        "2026-08-14": "leave", // matched with unpaid LWP -> 1.0 LOP
      })

      const leaves: LeaveRequest[] = [
        {
          id: "lv-03",
          employeeId: "emp-test-01",
          type: "unpaid",
          from: "2026-08-14",
          to: "2026-08-14",
          days: 1,
          reason: "Unpaid",
          state: "approved",
          submittedAt: "2026-08-10T00:00:00",
        },
      ]

      const row = computePayrollRow(records, leaves, testEmployee, "2026-08-03", "2026-08-14")

      assert.equal(row.workingDays, 10)
      assert.equal(row.wfhDays, 2)
      assert.equal(row.lateMarks, 3)
      assert.equal(row.lateDeductionDays, 0.5)

      // Expected LOP:
      // Half day = 0.5
      // Absent = 1.0
      // LWP = 1.0
      // Total LOP = 2.5 days
      assert.equal(row.lopDays, 2.5)

      // Expected payable days:
      // 10 working days - 2.5 LOP - 0.5 late deduction = 7.0 payable days
      assert.equal(row.payableDays, 7.0)

      // Per day: 120,000 / 10 = 12,000
      assert.equal(row.perDay, 12000)
      assert.equal(row.lateDeductionAmt, 6000)
      assert.equal(row.netAttendancePay, 84000)
    })
  })

  describe("Rule 7: Boundary Conditions & Non-Negative Clamping", () => {
    it("clamps payable days to 0 if absences exceed working days", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "absent",
        "2026-08-04": "absent",
        "2026-08-05": "absent",
      })

      const row = computePayrollRow(records, [], testEmployee, "2026-08-03", "2026-08-05")
      assert.equal(row.payableDays, 0)
      assert.equal(row.netAttendancePay, 0)
      assert.ok(row.payableDays >= 0, "Payable days must never be negative")
    })
  })

  describe("Rule 8: Monthly Analytics (computeMonthStats)", () => {
    it("calculates attendance percentage, late minutes, and worked hours correctly", () => {
      const records = makeRecords("emp-test-01", {
        "2026-08-03": "present", // 8h, 0m late
        "2026-08-04": "present", // 8h, 0m late
        "2026-08-05": "late", // 8h, 30m late
        "2026-08-06": "half-day", // 4h, 0m late
        "2026-08-07": "absent", // 0h, 0m late
      })

      const stats = computeMonthStats(records, "emp-test-01", "2026-08-03", "2026-08-07")

      assert.equal(stats.workingDays, 5)
      assert.equal(stats.present, 2)
      assert.equal(stats.late, 1)
      assert.equal(stats.halfDays, 1)
      assert.equal(stats.absent, 1)
      assert.equal(stats.totalLateMinutes, 30)

      // Present-equivalent: 2 (present) + 1 (late) + 0.5 (half-day) = 3.5 / 5 = 70.0%
      assert.equal(stats.attendancePct, 70.0)

      // Worked hours: (8 + 8 + 8 + 4) / 4 days worked = 28 / 4 = 7.0h
      assert.equal(stats.avgWorkedHours, 7.0)
    })
  })
})

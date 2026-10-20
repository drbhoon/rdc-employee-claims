type RoutingEmployee = {
  accountsName?: string | null;
  accountsEmail?: string | null;
  rmName?: string | null;
  rmEmail?: string | null;
  level1Name?: string | null;
  level1Email?: string | null;
  level2Name?: string | null;
  level2Email?: string | null;
};

function routingLine(label: string, name?: string | null, email?: string | null) {
  return `${label}: ${name || "Not mapped"}${email ? ` (${email})` : ""}`;
}

export function routingConfirmationMessage(employee: RoutingEmployee) {
  return [
    "Are you sure you want to submit this claim?",
    "",
    "Please confirm that your claim routing is correct:",
    routingLine("Accounts", employee.accountsName, employee.accountsEmail),
    routingLine("RM", employee.rmName, employee.rmEmail),
    routingLine("Level 1/BH", employee.level1Name, employee.level1Email),
    routingLine("Level 2/BH", employee.level2Name, employee.level2Email),
    "",
    "If any mapping is incorrect, cancel and contact Admin before submitting."
  ].join("\n");
}

import { Credential } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";

interface CredentialHealthProps {
  credentials: Credential[];
}

function getPasswordStrength(password: string): number {
  const strength = {
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    isLong: password.length >= 8,
  };
  return Object.values(strength).filter(Boolean).length;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function CredentialHealth({ credentials }: CredentialHealthProps) {
  // Calculate password strength distribution
  const strengthDistribution = Array(6).fill(0);
  credentials.forEach((cred) => {
    const strength = getPasswordStrength(cred.password);
    strengthDistribution[strength]++;
  });

  const passwordStrengthData = strengthDistribution.map((count, index) => ({
    strength: `Level ${index}`,
    count,
  }));

  // Calculate account type distribution
  const accountTypeDistribution = credentials.reduce((acc, cred) => {
    const type = cred.accountType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const accountTypeData = Object.entries(accountTypeDistribution).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  // Calculate status distribution
  const statusDistribution = credentials.reduce((acc, cred) => {
    const status = cred.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  // Calculate age distribution
  const ageDistribution = credentials.reduce((acc, cred) => {
    const lastChanged = cred.lastChanged ? new Date(cred.lastChanged) : new Date();
    const age = differenceInDays(new Date(), lastChanged);
    let category;
    if (age <= 30) category = "< 30 days";
    else if (age <= 90) category = "30-90 days";
    else if (age <= 180) category = "90-180 days";
    else if (age <= 365) category = "180-365 days";
    else category = "> 365 days";

    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ageData = Object.entries(ageDistribution).map(([age, count]) => ({
    age,
    count,
  }));

  // Calculate overall health score
  const totalCredentials = credentials.length;
  const healthMetrics = {
    strongPasswords: credentials.filter(c => getPasswordStrength(c.password) >= 4).length,
    recentlyUpdated: credentials.filter(c => {
      const lastChanged = c.lastChanged ? new Date(c.lastChanged) : new Date();
      return differenceInDays(new Date(), lastChanged) <= 180;
    }).length,
    activeStatus: credentials.filter(c => c.status === "Active").length,
  };

  const overallHealth = totalCredentials === 0 ? 0 : Math.round(
    ((healthMetrics.strongPasswords / totalCredentials) * 0.4 +
      (healthMetrics.recentlyUpdated / totalCredentials) * 0.3 +
      (healthMetrics.activeStatus / totalCredentials) * 0.3) * 100
  );

  // Add new metrics for credential updates over time
  const updateHistory = credentials.reduce((acc, cred) => {
    const date = cred.lastChanged ? format(new Date(cred.lastChanged), 'yyyy-MM-dd') : 'Never';
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const updateHistoryData = Object.entries(updateHistory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      count,
    }));

  // Calculate security score breakdown
  const securityMetrics = {
    passwordStrength: Math.round((healthMetrics.strongPasswords / totalCredentials) * 100),
    updateFrequency: Math.round((healthMetrics.recentlyUpdated / totalCredentials) * 100),
    accountStatus: Math.round((healthMetrics.activeStatus / totalCredentials) * 100),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Password Strength</h3>
            <div className="space-y-2">
              <Progress value={securityMetrics.passwordStrength} />
              <p className="text-sm text-muted-foreground">
                {healthMetrics.strongPasswords} out of {totalCredentials} passwords are strong ({securityMetrics.passwordStrength || 0}%)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Update Frequency</h3>
            <div className="space-y-2">
              <Progress value={securityMetrics.updateFrequency} />
              <p className="text-sm text-muted-foreground">
                {healthMetrics.recentlyUpdated} out of {totalCredentials} updated in last 180 days ({securityMetrics.updateFrequency || 0}%)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Account Status</h3>
            <div className="space-y-2">
              <Progress value={securityMetrics.accountStatus} />
              <p className="text-sm text-muted-foreground">
                {healthMetrics.activeStatus} out of {totalCredentials} accounts are active ({securityMetrics.accountStatus || 0}%)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> {/* Changed to 4 columns */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Password Strength Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={passwordStrengthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="strength" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Account Type Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={accountTypeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label
                >
                  {accountTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Credential Age Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="age" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Update History</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={updateHistoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
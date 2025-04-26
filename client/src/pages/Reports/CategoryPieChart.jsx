import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Color palette for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#a4de6c"];

/**
 * Component for rendering category data as a pie chart
 * Accepts a 'type' prop: 'income' or 'outcome'.
 * Only shows relevant categories for the selected type.
 * For outcome, includes 'Withdrawal' as a category if present.
 */
const INCOME_CATEGORIES = [
  "Salary", "Gifts", "Refunds", "Deposit", "Other"
];
const OUTCOME_CATEGORIES = [
  "Food", "Utilities", "Housing", "Transportation", "Withdrawal", "Other"
];

const CategoryPieChart = ({ categoryData = {}, type = "income" }) => {
  // Select relevant categories based on type
  const allowedCategories = type === "income" ? INCOME_CATEGORIES : OUTCOME_CATEGORIES;
  
  // Filter the data based on type and create chart data
  const chartData = Object.entries(categoryData)
    .filter(([name, value]) => allowedCategories.includes(name) && value > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CategoryPieChart;

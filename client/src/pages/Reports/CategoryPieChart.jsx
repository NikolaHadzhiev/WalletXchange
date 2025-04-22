import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Color palette for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#a4de6c"];

/**
 * Component for rendering category data as a pie chart
 * Ensures all categories with values > 0 are displayed
 */
const CategoryPieChart = ({ categoryData = {} }) => {
  // Transform category data into format needed for pie chart
  // Explicitly filter for values > 0 to ensure all categories (including Withdrawal) are displayed
  const chartData = Object.entries(categoryData)
    .filter(([, value]) => value > 0) // Using comma instead of underscore avoids ESLint warning
    .map(([name, value]) => ({
      name,
      value
    }));

  return (
    <ResponsiveContainer width="100%" height={210}>
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

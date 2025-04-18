import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Col, Row, Card, DatePicker, Statistic, Select, Space, message } from "antd";
import { 
  AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import moment from "moment";
import PageTitle from "../../components/PageTitle";
import { GetTransactionSummary, GetMonthlyData, GetCategorySummary } from "../../api/reports";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";

// Color palette for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

function ReportsPage() {
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  
  // State variables
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netFlow: 0,
    incomingTransactionCount: 0,
    outgoingTransactionCount: 0
  });

  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState({
    expenseCategories: {},
    incomeCategories: {}
  });
  
  // Filter states
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);
  
  // Functions to fetch data
  const fetchSummaryData = async (yearValue = selectedYear) => {
    try {
        dispatch(ShowLoading());
        
        const payload = {
          userId: user._id
        };
        
        // Add date filters if selected
        if (dateRange[0] && dateRange[1]) {
          payload.fromDate = dateRange[0].format("YYYY-MM-DD");
          payload.toDate = dateRange[1].format("YYYY-MM-DD");
        } else if (selectedMonth) {
          // If month is selected, create date range for that month
          const year = yearValue || new Date().getFullYear();
          const startOfMonth = moment([year, selectedMonth - 1, 1]);
          const endOfMonth = moment(startOfMonth).endOf("month");

          payload.fromDate = startOfMonth.format("YYYY-MM-DD");
          payload.toDate = endOfMonth.format("YYYY-MM-DD");
        }
      
      const response = await GetTransactionSummary(payload);
      
      if (response.success) {
        setSummary(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching summary data");
    }
  };

  const fetchMonthlyData = async (yearValue = selectedYear) => {
    try {
      dispatch(ShowLoading());
      
      const response = await GetMonthlyData({
        userId: user._id,
        year: yearValue
      });
      
      if (response.success) {
        // Transform the data to include month names
        const transformedData = response.data.map(item => ({
          ...item,
          monthName: moment().month(item.month - 1).format("MMM"),
        }));
        setMonthlyData(transformedData);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching monthly data");
    }
  };

  const fetchCategoryData = async (yearValue = selectedYear) => {
    try {
      dispatch(ShowLoading());
      
      const payload = {
        userId: user._id
      };
      
      // Add date filters if selected
      if (dateRange[0] && dateRange[1]) {
        payload.fromDate = dateRange[0].format("YYYY-MM-DD");
        payload.toDate = dateRange[1].format("YYYY-MM-DD");
      } else if (selectedMonth) {
        // If month is selected, create date range for that month
        const year = yearValue || new Date().getFullYear();
        const startOfMonth = moment([year, selectedMonth - 1, 1]);
        const endOfMonth = moment(startOfMonth).endOf('month');
        
        payload.fromDate = startOfMonth.format("YYYY-MM-DD");
        payload.toDate = endOfMonth.format("YYYY-MM-DD");
      }

      const response = await GetCategorySummary(payload);
      
      if (response.success) {
        setCategoryData(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching category data");
    }
  };

  // Helper functions to handle direct month values
  const fetchSummaryDataWithMonth = async (yearValue, monthValue) => {
    try {
      dispatch(ShowLoading());
      
      const payload = {
        userId: user._id
      };
      
      // Use the direct month value
      const year = yearValue || new Date().getFullYear();
      const month = monthValue;
      
      if (month) {
        const startOfMonth = moment([year, month - 1, 1]);
        const endOfMonth = moment(startOfMonth).endOf("month");
        
        payload.fromDate = startOfMonth.format("YYYY-MM-DD");
        payload.toDate = endOfMonth.format("YYYY-MM-DD");
      }
      
      const response = await GetTransactionSummary(payload);
      
      if (response.success) {
        setSummary(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching summary data");
    }
  };

  const fetchCategoryDataWithMonth = async (yearValue, monthValue) => {
    try {
      dispatch(ShowLoading());
      
      const payload = {
        userId: user._id
      };
      
      // Use the direct month value
      const year = yearValue || new Date().getFullYear();
      const month = monthValue;
      
      if (month) {
        const startOfMonth = moment([year, month - 1, 1]);
        const endOfMonth = moment(startOfMonth).endOf("month");
        
        payload.fromDate = startOfMonth.format("YYYY-MM-DD");
        payload.toDate = endOfMonth.format("YYYY-MM-DD");
      }
      
      const response = await GetCategorySummary(payload);
      
      if (response.success) {
        setCategoryData(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching category data");
    }
  };

  // Helper functions to handle full year range when no month is selected
  const fetchSummaryDataWithYearRange = async (yearValue, startDate, endDate) => {
    try {
      dispatch(ShowLoading());
      
      const payload = {
        userId: user._id,
        fromDate: startDate.format("YYYY-MM-DD"),
        toDate: endDate.format("YYYY-MM-DD")
      };
      
      const response = await GetTransactionSummary(payload);
      
      if (response.success) {
        setSummary(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching summary data");
    }
  };

  const fetchCategoryDataWithYearRange = async (yearValue, startDate, endDate) => {
    try {
      dispatch(ShowLoading());
      
      const payload = {
        userId: user._id,
        fromDate: startDate.format("YYYY-MM-DD"),
        toDate: endDate.format("YYYY-MM-DD")
      };
      
      const response = await GetCategorySummary(payload);
      
      if (response.success) {
        setCategoryData(response.data);
      } else {
        message.error(response.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching category data");
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchSummaryData();
    fetchMonthlyData();
    fetchCategoryData();
  }, []);

  // Handle date range change
  const handleDateRangeChange = async (dates) => {
    setDateRange(dates);
    setSelectedMonth(null); // Clear month selection when date range is set
    
    if (dates && dates[0] && dates[1]) {
      await fetchSummaryData(selectedYear);
      await fetchCategoryData(selectedYear);
    }
  };  
  
  // Handle month change
  const handleMonthChange = async (value) => {
    setDateRange([null, null]); // Clear date range when month is selected
    setSelectedMonth(value);
    
    // If value is null (cleared) or undefined, show full year data
    if (value === null || value === undefined) {
      // Create a date range for the entire selected year
      const startOfYear = moment([selectedYear, 0, 1]); // January 1st of selected year
      const endOfYear = moment([selectedYear, 11, 31]); // December 31st of selected year
      
      await fetchSummaryDataWithYearRange(selectedYear, startOfYear, endOfYear);
      await fetchCategoryDataWithYearRange(selectedYear, startOfYear, endOfYear);
    } else {
      // Store the month value for direct use in API calls
      const monthValue = value;
      
      // Modify the fetchSummaryData and fetchCategoryData functions to use the direct month value
      await fetchSummaryDataWithMonth(selectedYear, monthValue);
      await fetchCategoryDataWithMonth(selectedYear, monthValue);
    }
  };
  
  // Handle year change for monthly data
  const handleYearChange = async (value) => {
    setSelectedYear(value);
    
    // Re-fetch data with the new year filter using the updated year value directly
    await fetchMonthlyData(value);
    
    // If no month is selected, use full year date range
    if (!selectedMonth) {
      // Create a date range for the entire selected year
      const startOfYear = moment([value, 0, 1]); // January 1st of selected year
      const endOfYear = moment([value, 11, 31]); // December 31st of selected year
      
      await fetchSummaryDataWithYearRange(value, startOfYear, endOfYear);
      await fetchCategoryDataWithYearRange(value, startOfYear, endOfYear);
    } else {
      await fetchSummaryData(value);
      await fetchCategoryData(value);
    }
  };

  // Reset all filters
  const handleResetFilters = async () => {
    const currentYear = new Date().getFullYear();

    setDateRange([null, null]);
    setSelectedMonth(null);
    setSelectedYear(currentYear);
    
    // Re-fetch all data without filters
    await fetchSummaryData(currentYear);
    await fetchMonthlyData(currentYear);
    await fetchCategoryData(currentYear);
  };

  // Transform category data for pie charts
  const transformCategoryData = (categoryObj) => {
    return Object.entries(categoryObj || {}).map(([name, value]) => ({ 
      name, 
      value 
    }));
  };

  // Available years for dropdown selection
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { label: year.toString(), value: year };
  });

  // Month options for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    return { 
      label: moment().month(i).format('MMMM'), 
      value: i + 1 
    };
  });

  // Handle clearing the month filter
  const handleClearMonth = async () => {
    setSelectedMonth(null);

    const startOfYear = moment([selectedYear, 0, 1]); // January 1st of selected year
    const endOfYear = moment([selectedYear, 11, 31]); // December 31st of selected year
    
    await fetchSummaryDataWithYearRange(selectedYear, startOfYear, endOfYear);
    await fetchCategoryDataWithYearRange(selectedYear, startOfYear, endOfYear);
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <PageTitle title="Financial Reports" />
        
        <div>
          <Space size="middle" align="center">
            <Space>              
              <Select
                placeholder="Select Month"
                style={{ width: 120 }}
                onChange={handleMonthChange}
                onClear={handleClearMonth}
                value={selectedMonth}
                options={monthOptions}
                allowClear
                disabled={dateRange[0] !== null || dateRange[1] !== null}
              />
              
              <Select
                style={{ width: 100 }}
                value={selectedYear}
                onChange={handleYearChange}
                options={yearOptions}
              />
            </Space>
            <span>OR</span>            
            <DatePicker.RangePicker
              style={{ width: 250 }}
              onChange={handleDateRangeChange}
              value={dateRange}
              disabled={selectedMonth !== null}
            />
            <a onClick={handleResetFilters}>Reset</a>
          </Space>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} className="mt-4">
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Income"
              value={summary.totalIncome}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Expenses"
              value={summary.totalExpenses}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Net Flow"
              value={summary.netFlow}
              precision={2}
              prefix="$"
              valueStyle={{ color: summary.netFlow >= 0 ? "#3f8600" : "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} className="mt-4">
        <Col span={12}>
          <Card>
            <Statistic
              title="Incoming Transactions"
              value={summary.incomingTransactionCount}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="Outgoing Transactions"
              value={summary.outgoingTransactionCount}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Monthly Income & Expenses" className="mt-4">
        <div className="mb-2">
          <Select
            value={selectedYear}
            style={{ width: 120 }}
            onChange={handleYearChange}
            options={yearOptions}
          />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={monthlyData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#82ca9d"
              fill="#82ca9d"
              fillOpacity={0.3}
              name="Income"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ff8042"
              fill="#ff8042"
              fillOpacity={0.3}
              name="Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Category Charts */}
      <Row gutter={16} className="mt-4">
        <Col span={12}>
          <Card title="Expense Categories">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transformCategoryData(categoryData.expenseCategories)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {transformCategoryData(categoryData.expenseCategories).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Income Categories">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transformCategoryData(categoryData.incomeCategories)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {transformCategoryData(categoryData.incomeCategories).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ReportsPage;
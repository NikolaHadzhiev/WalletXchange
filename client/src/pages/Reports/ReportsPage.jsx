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
    // If dates is null or doesn't contain two valid dates, just update the state
    if (!dates || !dates[0] || !dates[1]) {
      setDateRange(dates);
      return;
    }

    // Check if start date is after end date
    if (dates[0].isAfter(dates[1])) {
      message.error("Start date cannot be after end date");
      return;
    }

    setDateRange(dates);
    setSelectedMonth(null); // Clear month selection when date range is set
    
    // Use the actual dates that were passed to the function
    // instead of relying on the updated state
    const payload = {
      userId: user._id,
      fromDate: dates[0].format("YYYY-MM-DD"),
      toDate: dates[1].format("YYYY-MM-DD")
    };
    
    try {
      dispatch(ShowLoading());
      
      // Fetch summary data
      const summaryResponse = await GetTransactionSummary(payload);
      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      } else {
        message.error(summaryResponse.message);
      }
      
      // Fetch category data
      const categoryResponse = await GetCategorySummary(payload);
      if (categoryResponse.success) {
        setCategoryData(categoryResponse.data);
      } else {
        message.error(categoryResponse.message);
      }
      
      // Also fetch monthly data for the selected year (with the date range filter)
      const monthlyResponse = await GetMonthlyData({
        userId: user._id,
        year: dates[0].year(),
        fromDate: dates[0].format("YYYY-MM-DD"),
        toDate: dates[1].format("YYYY-MM-DD")
      });
      
      if (monthlyResponse.success) {
        // Transform the data to include month names
        const transformedData = monthlyResponse.data.map(item => ({
          ...item,
          monthName: moment().month(item.month - 1).format("MMM"),
        }));
        setMonthlyData(transformedData);
      } else {
        message.error(monthlyResponse.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching data");
    }
  };  
    // Handle month change
  const handleMonthChange = async (value) => {
    setDateRange([null, null]);    
    // When clearing, value will be undefined, explicitly set to null
    if (value === undefined) {
      value = null;
    }
    
    setSelectedMonth(value);
    
    // If value is null (cleared) or undefined, show full year data
    if (value === null || value === undefined) {
      await handleClearMonth(); // Reuse the clear month handler
    } else {
      const monthValue = value;
      
      // Get first and last days of the selected month in the selected year
      const startOfMonth = moment([selectedYear, monthValue - 1, 1]);
      const endOfMonth = moment([selectedYear, monthValue - 1]).endOf('month');
      
      try {
        dispatch(ShowLoading());
        
        // Format dates for API
        const fromDate = startOfMonth.format("YYYY-MM-DD");
        const toDate = endOfMonth.format("YYYY-MM-DD");
        
        const payload = {
          userId: user._id,
          fromDate,
          toDate
        };
        
        // Fetch summary data
        const summaryResponse = await GetTransactionSummary(payload);
        if (summaryResponse.success) {
          setSummary(summaryResponse.data);
        } else {
          message.error(summaryResponse.message);
        }
        
        // Fetch category data
        const categoryResponse = await GetCategorySummary(payload);
        if (categoryResponse.success) {
          setCategoryData(categoryResponse.data);
        } else {
          message.error(categoryResponse.message);
        }
        
        // Fetch monthly data with the month filter
        const monthlyResponse = await GetMonthlyData({
          userId: user._id,
          year: selectedYear,
          fromDate,
          toDate
        });
        
        if (monthlyResponse.success) {
          // Transform the data to include month names
          const transformedData = monthlyResponse.data.map(item => ({
            ...item,
            monthName: moment().month(item.month - 1).format("MMM"),
          }));
          setMonthlyData(transformedData);
        } else {
          message.error(monthlyResponse.message);
        }
        
        dispatch(HideLoading());
      } catch (error) {
        dispatch(HideLoading());
        message.error("Something went wrong while fetching data");
      }
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

    // Update state
    setDateRange([null, null]);
    setSelectedMonth(null);
    setSelectedYear(currentYear);
    
    // Re-fetch all data without filters
    // Pass the currentYear directly to avoid state lag
    try {
      dispatch(ShowLoading());
      
      // Run all fetch operations with the new values directly
      const summaryPromise = GetTransactionSummary({ userId: user._id });
      const monthlyPromise = GetMonthlyData({ userId: user._id, year: currentYear });
      const categoryPromise = GetCategorySummary({ userId: user._id });
      
      const [summaryResponse, monthlyResponse, categoryResponse] = await Promise.all([
        summaryPromise,
        monthlyPromise,
        categoryPromise
      ]);
      
      // Update state with new data
      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      } else {
        message.error(summaryResponse.message);
      }
      
      if (monthlyResponse.success) {
        const transformedData = monthlyResponse.data.map(item => ({
          ...item,
          monthName: moment().month(item.month - 1).format("MMM"),
        }));
        setMonthlyData(transformedData);
      } else {
        message.error(monthlyResponse.message);
      }
      
      if (categoryResponse.success) {
        setCategoryData(categoryResponse.data);
      } else {
        message.error(categoryResponse.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while resetting filters");
    }
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
    
    try {
      dispatch(ShowLoading());
      
      // Format dates for API
      const fromDate = startOfYear.format("YYYY-MM-DD");
      const toDate = endOfYear.format("YYYY-MM-DD");
      
      // Fetch summary data
      await fetchSummaryDataWithYearRange(selectedYear, startOfYear, endOfYear);
      
      // Fetch category data
      await fetchCategoryDataWithYearRange(selectedYear, startOfYear, endOfYear);
      
      // Also fetch monthly data for the entire year
      const monthlyResponse = await GetMonthlyData({
        userId: user._id,
        year: selectedYear,
        fromDate,
        toDate
      });
      
      if (monthlyResponse.success) {
        // Transform the data to include month names
        const transformedData = monthlyResponse.data.map(item => ({
          ...item,
          monthName: moment().month(item.month - 1).format("MMM"),
        }));
        setMonthlyData(transformedData);
      } else {
        message.error(monthlyResponse.message);
      }
      
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("Something went wrong while fetching data");
    }
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
                disabled={dateRange && (dateRange[0] !== null || dateRange[1] !== null)}
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
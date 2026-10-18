import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const StatsChart = ({ stats }) => {
  const labels = stats.map(
    (s) => `${MONTH_NAMES[Number(s.month) - 1] || s.month} ${s.year}`
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Hours Worked",
        data: stats.map((s) => Number(s.totalHours || 0)),
        backgroundColor: "#4a90e2",
        yAxisID: "yHours",
      },
      {
        label: "Pay Earned ($)",
        data: stats.map((s) => Number(s.totalPay || 0)),
        backgroundColor: "#f5a35c",
        yAxisID: "yPay",
      },
    ],
  };

  const options = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    scales: {
      yHours: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        title: { display: true, text: "Hours" },
      },
      yPay: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        title: { display: true, text: "Pay ($)" },
        grid: { drawOnChartArea: false },
      },
    },
  };

  return <Bar data={data} options={options} />;
};

export default StatsChart;

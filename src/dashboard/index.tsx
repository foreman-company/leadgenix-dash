import React from "react";
import styles from "./Dashboard.module.css";
import { Helmet } from "react-helmet";

export default function DashboardPage() {
  return (
    <div className={styles.dashboardContainer}>
      <Helmet>
        <title>Leadgenix Dashboard</title>
      </Helmet>
      <h1 className={styles.title}>Leadgenix Dashboard</h1>
      <p className={styles.intro}>
        Welcome to the Leadgenix dashboard. In the next steps we will
        connect to HubSpot, create widgets, and render real lead
        tracking data.
      </p>
    </div>
  );
}
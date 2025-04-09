function Component({ events }) {
  // Aggregate events by type and track their state progression
  const aggregateEvents = () => {
    const retrieveEvents = events.filter((e) => e.event === "retrieve");
    const analyzeEvents = events.filter((e) => e.event === "analyze");
    const answerEvents = events.filter((e) => e.event === "answer");

    // Get the latest state for retrieve and analyze events
    const retrieveState =
      retrieveEvents.length > 0
        ? retrieveEvents[retrieveEvents.length - 1].state
        : null;
    const analyzeState =
      analyzeEvents.length > 0
        ? analyzeEvents[analyzeEvents.length - 1].state
        : null;

    // Group answer events by their ID
    const answerGroups = {};
    for (const event of answerEvents) {
      if (!event.id) continue;

      if (!answerGroups[event.id]) {
        answerGroups[event.id] = {
          id: event.id,
          question: event.question,
          answer: event.answer,
          states: [],
        };
      }

      const lastState =
        answerGroups[event.id].states[answerGroups[event.id].states.length - 1];
      if (lastState !== event.state) {
        answerGroups[event.id].states.push(event.state);
      }

      if (event.answer) {
        answerGroups[event.id].answer = event.answer;
      }
    }

    return {
      retrieveState,
      analyzeState,
      answerGroups: Object.values(answerGroups),
    };
  };

  const { retrieveState, analyzeState, answerGroups } = aggregateEvents();

  // Styles
  const styles = {
    container: {
      fontFamily: "Arial, sans-serif",
      maxWidth: "900px",
      margin: "0 auto",
      padding: "20px",
      backgroundColor: "#FFFFFF",
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    },
    header: {
      fontSize: "24px",
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: "20px",
      color: "#333",
    },
    cardsContainer: {
      display: "flex",
      gap: "16px",
      marginBottom: "30px",
      flexWrap: "wrap",
    },
    card: {
      flex: "1",
      minWidth: "250px",
      backgroundColor: "#FFFFFF",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      padding: "16px",
      border: "1px solid #E5E7EB",
      transition: "all 0.3s ease",
    },
    cardHeader: {
      display: "flex",
      alignItems: "center",
      marginBottom: "12px",
    },
    cardTitle: {
      fontSize: "18px",
      fontWeight: "bold",
      marginLeft: "8px",
    },
    cardContent: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    badge: {
      padding: "4px 8px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: "bold",
    },
    questionsList: {
      marginTop: "30px",
    },
    questionItem: {
      backgroundColor: "#F9FAFB",
      border: "1px solid #E5E7EB",
      borderRadius: "8px",
      marginBottom: "12px",
      overflow: "hidden",
    },
    questionHeader: {
      padding: "12px 16px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      userSelect: "none",
    },
    questionTitle: {
      fontWeight: "medium",
      marginLeft: "12px",
    },
    answerContainer: {
      padding: "0",
      backgroundColor: "#F3F4F6",
      overflow: "hidden",
      maxHeight: "0",
      transition: "max-height 0.3s ease-out",
    },
    answerContent: {
      padding: "16px",
    },
    answerContainerExpanded: {
      maxHeight: "1000px", // Adjust based on content
    },
    arrow: {
      marginLeft: "8px",
      transition: "transform 0.3s ease",
      display: "inline-block",
    },
    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "24px",
      color: "#6B7280",
    },
    stateIconContainer: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
  };

  // Helper function to get color for a state
  const getStateColor = (state) => {
    switch (state) {
      case "inprogress":
        return "#FCD34D";
      case "done":
        return "#34D399";
      case "pending":
        return "#9CA3AF";
      default:
        return "#D1D5DB";
    }
  };

  // Helper function to get badge styles based on state
  const getBadgeStyles = (state) => {
    const colors = {
      inprogress: { background: "#FEF3C7", color: "#92400E" },
      done: { background: "#D1FAE5", color: "#065F46" },
      pending: { background: "#F3F4F6", color: "#1F2937" },
    };
    const stateColors = colors[state] || colors.pending;
    return {
      ...styles.badge,
      backgroundColor: stateColors.background,
      color: stateColors.color,
    };
  };

  // Helper function to render state icon
  const renderStateIcon = (state) => {
    const color = getStateColor(state);
    if (state === "inprogress") {
      return (
        <div style={{ color, animation: "spin 1s linear infinite" }}>⟳</div>
      );
    } else if (state === "done") {
      return <div style={{ color }}>✓</div>;
    } else if (state === "pending") {
      return <div style={{ color }}>⏱</div>;
    }
    return <div style={{ color }}>?</div>;
  };

  // State for toggling question answers
  const [expandedQuestions, setExpandedQuestions] = React.useState({});

  const toggleQuestion = (questionId) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Research Progress</h1>

      {/* Status Cards */}
      <div style={styles.cardsContainer}>
        {/* Retrieve Card */}
        <div
          style={{
            ...styles.card,
            borderColor:
              retrieveState === "done"
                ? "#A7F3D0"
                : retrieveState === "inprogress"
                  ? "#FDE68A"
                  : "#E5E7EB",
          }}
        >
          <div style={styles.cardHeader}>
            <span style={{ color: "#8B5CF6" }}>🔍</span>
            <div style={styles.cardTitle}>Data Retrieval</div>
          </div>
          <div style={styles.cardContent}>
            <span style={{ fontSize: "14px", color: "#6B7280" }}>Status:</span>
            <div style={styles.stateIconContainer}>
              {retrieveState && (
                <span style={getBadgeStyles(retrieveState)}>
                  {retrieveState === "inprogress"
                    ? "In Progress"
                    : retrieveState === "done"
                      ? "Completed"
                      : "Pending"}
                </span>
              )}
              {renderStateIcon(retrieveState)}
            </div>
          </div>
        </div>

        {/* Analyze Card */}
        <div
          style={{
            ...styles.card,
            borderColor:
              analyzeState === "done"
                ? "#A7F3D0"
                : analyzeState === "inprogress"
                  ? "#FDE68A"
                  : "#E5E7EB",
          }}
        >
          <div style={styles.cardHeader}>
            <span style={{ color: "#06B6D4" }}>📊</span>
            <div style={styles.cardTitle}>Data Analysis</div>
          </div>
          <div style={styles.cardContent}>
            <span style={{ fontSize: "14px", color: "#6B7280" }}>Status:</span>
            <div style={styles.stateIconContainer}>
              {analyzeState && (
                <span style={getBadgeStyles(analyzeState)}>
                  {analyzeState === "inprogress"
                    ? "In Progress"
                    : analyzeState === "done"
                      ? "Completed"
                      : "Pending"}
                </span>
              )}
              {renderStateIcon(analyzeState)}
            </div>
          </div>
        </div>

        {/* Questions Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={{ color: "#10B981" }}>💬</span>
            <div style={styles.cardTitle}>Questions</div>
          </div>
          <div style={styles.cardContent}>
            <span style={{ fontSize: "14px", color: "#6B7280" }}>Status:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  ...styles.badge,
                  backgroundColor: "#F3F4F6",
                  color: "#1F2937",
                }}
              >
                {answerGroups.length} Questions
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#059669",
                }}
              >
                {answerGroups.filter((g) => g.states.includes("done")).length}{" "}
                Answered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {answerGroups.length > 0 && (
        <div style={styles.questionsList}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginBottom: "16px",
            }}
          >
            Research Questions
          </h2>
          {answerGroups.map((group, index) => {
            const latestState = group.states[group.states.length - 1];
            const questionId = group.id || `question-${index}`;
            const isExpanded = expandedQuestions[questionId];

            return (
              <div key={questionId} style={styles.questionItem}>
                <div
                  style={styles.questionHeader}
                  onClick={() => toggleQuestion(questionId)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    {renderStateIcon(latestState)}
                    <span style={styles.questionTitle}>{group.question}</span>
                    <span
                      style={{
                        ...styles.arrow,
                        transform: isExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▼
                    </span>
                  </div>
                  <span style={getBadgeStyles(latestState)}>
                    {latestState === "inprogress"
                      ? "In Progress"
                      : latestState === "done"
                        ? "Answered"
                        : "Pending"}
                  </span>
                </div>
                <div
                  style={{
                    ...styles.answerContainer,
                    ...(isExpanded ? styles.answerContainerExpanded : {}),
                  }}
                >
                  {group.answer ? (
                    <div style={styles.answerContent}>{group.answer}</div>
                  ) : (
                    <div
                      style={{
                        ...styles.loadingContainer,
                        ...styles.answerContent,
                      }}
                    >
                      <span style={{ marginLeft: "8px" }}>
                        Generating answer...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

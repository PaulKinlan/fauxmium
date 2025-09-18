document.addEventListener("DOMContentLoaded", () => {
  const costContainer = document.getElementById("cost-container");

  chrome.storage.local.get(["hostname", "port"], (result) => {
    const { hostname, port } = result;

    if (!hostname || !port) {
      costContainer.textContent = "Configuration not found.";
      return;
    }

    const COST_URL = `http://${hostname}:${port}/cost`;

    fetch(COST_URL)
      .then((response) => response.json())
      .then((data) => {
        const totalCost = document.createElement("p");
        totalCost.textContent = `Total Cost: $${data.total.toFixed(6)}`;
        costContainer.appendChild(totalCost);

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        const headerRow = document.createElement("tr");

        const urlHeader = document.createElement("th");
        urlHeader.textContent = "URL";
        headerRow.appendChild(urlHeader);

        const modelHeader = document.createElement("th");
        modelHeader.textContent = "Model";
        headerRow.appendChild(modelHeader);

        const costHeader = document.createElement("th");
        costHeader.textContent = "Cost (USD)";
        headerRow.appendChild(costHeader);

        thead.appendChild(headerRow);

        for (const request of data.requests) {
          const row = document.createElement("tr");

          const urlCell = document.createElement("td");
          urlCell.textContent = request.url;
          row.appendChild(urlCell);

          const modelCell = document.createElement("td");
          modelCell.textContent = request.model;
          row.appendChild(modelCell);

          const costCell = document.createElement("td");
          costCell.textContent = `$${request.cost.toFixed(6)}`;
          row.appendChild(costCell);

          tbody.appendChild(row);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        costContainer.appendChild(table);
      })
      .catch((error) => {
        costContainer.textContent =
          "Error fetching cost data. Is the server running?";
        console.error("Error:", error);
      });
  });
});

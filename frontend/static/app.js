const $ = (id) => document.getElementById(id);
$("workflow-form").addEventListener("submit", async (event) => {
  event.preventDefault(); $("status").textContent = "Running deterministic workflow…"; $("results").textContent = "";
  try {
    const project = await fetch("/api/projects", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("name").value})}).then(r=>r.json());
    if (!project.success) throw new Error(project.error.message);
    const run = await fetch(`/api/projects/${project.data.public_id}/requirements`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({raw_requirement:$("requirement").value})}).then(r=>r.json());
    if (!run.success) throw new Error(run.error.message);
    const view = await fetch(`/api/projects/${project.data.public_id}`).then(r=>r.json());
    $("status").className = run.data.state === "COMPLETED" ? "success" : "error";
    $("status").textContent = `Workflow ${run.data.state.toLowerCase()} for ${project.data.public_id}.`;
    const output = document.createElement("pre"); output.textContent = JSON.stringify(view.data, null, 2); $("results").append(output);
  } catch (error) { $("status").className="error"; $("status").textContent=`Workflow failed: ${error.message}`; }
});

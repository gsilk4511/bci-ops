// Owns the database testing presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { data, head, me } from '../app.js';

export function testingPage(){
 return head('Database Testing','Read only','Inspect BCI Operations records allowed by your access profile.')+(me?.rawDatabaseTesting?'<div class="actions"><button class="secondary" data-db-mode="records">App records</button><button class="secondary" data-db-mode="raw">Raw MariaDB</button></div>':'')+'<section class="panel" id="databaseResults" aria-live="polite"></section>';
}


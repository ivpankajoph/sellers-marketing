import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import WindowInbox from "@/pages/inbox/WindowInbox";
import WhatsAppLeads from "@/pages/inbox/WhatsAppLeads";
import Campaigns from "@/pages/campaigns";
import Automation from "@/pages/automation";
import Contacts from "@/pages/contacts";
import Settings from "@/pages/settings";
import TeamMembers from "@/pages/settings/TeamMembers";
import Permissions from "@/pages/settings/Permissions";
import WhatsAppNumber from "@/pages/settings/WhatsAppNumber";
import ProfileDetails from "@/pages/settings/ProfileDetails";
import WebhookAPI from "@/pages/settings/WebhookAPI";
import WebhookEvents from "@/pages/settings/WebhookEvents";
import Billing from "@/pages/settings/Billing";

import Templates from "@/pages/templates";

// New Imports
import Broadcast from "@/pages/campaigns/Broadcast";
import SelectedContacts from "@/pages/campaigns/SelectedContacts";
import Schedule from "@/pages/campaigns/Schedule";
import Single from "@/pages/campaigns/Single";
import Report from "@/pages/campaigns/Report";
import CampaignPage from "@/pages/campaigns/CampaignPage";

import AutoLeads from "@/pages/automation/AutoLeads";
import Keywords from "@/pages/automation/Keywords";
import FollowUp from "@/pages/automation/FollowUp";
import Drip from "@/pages/automation/Drip";
import NewLeads from "@/pages/automation/NewLeads";
import AutomationDashboard from "@/pages/automation/AutomationDashboard";
import TriggersPage from "@/pages/automation/TriggersPage";
import FlowsPage from "@/pages/automation/FlowsPage";
import FlowEditor from "@/pages/automation/FlowEditor";
import CampaignsPage from "@/pages/automation/CampaignsPage";
import SegmentsPage from "@/pages/automation/SegmentsPage";
import AnalyticsPage from "@/pages/automation/AnalyticsPage";
import InterestLists from "@/pages/automation/InterestLists";

import ConnectApps from "@/pages/apps/ConnectApps";

import AddTemplate from "@/pages/templates/AddTemplate";
import TemplateStatus from "@/pages/templates/TemplateStatus";
import ManageTemplates from "@/pages/templates/ManageTemplates";

import NewAgent from "@/pages/ai/NewAgent";
import ManageAgents from "@/pages/ai/ManageAgents";
import AgentsPage from "@/pages/ai/AgentsPage";
import MapAgent from "@/pages/ai/MapAgent";
import AgentReports from "@/pages/ai/AgentReports";
import PrefilledTextMappings from "@/pages/ai/PrefilledTextMappings";

import LeadForms from "@/pages/facebook/LeadForms";
import Leads from "@/pages/facebook/Leads";
import WhatsAppFlowsPage from "@/pages/whatsapp/FlowsPage";

import DeliveryReport from "@/pages/reports/DeliveryReport";
import CampaignPerformance from "@/pages/reports/CampaignPerformance";
import CustomerReplies from "@/pages/reports/CustomerReplies";
import AgentPerformance from "@/pages/reports/AgentPerformance";
import Spending from "@/pages/reports/Spending";
import Credits from "@/pages/reports/Credits";
import UserEngagement from "@/pages/reports/UserEngagement";
import BroadcastReports from "@/pages/reports/BroadcastReports";
import BlockedContacts from "@/pages/reports/BlockedContacts";
import ContactReports from "@/pages/reports/ContactReports";
import UserManagement from "@/pages/UserManagement";
import LeadAssignmentReports from "@/pages/lead-assignment-reports";
import UserActivityReports from "@/pages/user-activity-reports";
import TokenCardMain from "./pages/AItokens";
import WhatsTokenCardMain from "./pages/WhatsappTokens";
import ContactUsageDetail from "./pages/ContactUsageDetails";
import AiUsageDashboard from "./pages/AiUsageDashboard";
import UserManagementDashboard from "./pages/UserManagementDashboard";
import Register from "./pages/Register";
import FBLeadAutomationReport from "./pages/FbleadsReport";
import WhatsAppFlowBuilder from "./pages/CreateFlow";
import DripCampaignReport from "./pages/DripCampaignReport";
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/forgot-password">
        {isAuthenticated ? <Redirect to="/" /> : <ForgotPassword />}
      </Route>
      <Route path="/reset-password">
        {isAuthenticated ? <Redirect to="/" /> : <ResetPassword />}
      </Route>
      <Route path="/">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/inbox/window">
        {() => <ProtectedRoute component={WindowInbox} />}
      </Route>
      <Route path="/inbox/leads">
        {() => <ProtectedRoute component={WhatsAppLeads} />}
      </Route>
      <Route path="/inbox">{() => <ProtectedRoute component={Inbox} />}</Route>

      {/* Campaigns */}
      <Route path="/campaigns">
        {() => <ProtectedRoute component={Campaigns} />}
      </Route>
      <Route path="/campaigns/manager">
        {() => <ProtectedRoute component={CampaignPage} />}
      </Route>
      <Route path="/campaigns/broadcast">
        {() => <ProtectedRoute component={Broadcast} />}
      </Route>
      <Route path="/campaigns/selected-contacts">
        {() => <ProtectedRoute component={SelectedContacts} />}
      </Route>
      <Route path="/campaigns/schedule">
        {() => <ProtectedRoute component={Schedule} />}
      </Route>
      <Route path="/campaigns/single">
        {() => <ProtectedRoute component={Single} />}
      </Route>
      <Route path="/campaigns/report">
        {() => <ProtectedRoute component={Report} />}
      </Route>

      {/* Automation */}
      <Route path="/automation">
        {() => <ProtectedRoute component={Automation} />}
      </Route>
      <Route path="/automation/dashboard">
        {() => <ProtectedRoute component={AutomationDashboard} />}
      </Route>
      <Route path="/automation/triggers">
        {() => <ProtectedRoute component={TriggersPage} />}
      </Route>
      <Route path="/automation/triggers/new">
        {() => <ProtectedRoute component={TriggersPage} />}
      </Route>
      <Route path="/automation/flows">
        {() => <ProtectedRoute component={FlowsPage} />}
      </Route>
      <Route path="/automation/flows/new">
        {() => <ProtectedRoute component={FlowEditor} />}
      </Route>
      <Route path="/automation/flows/:flowId/edit">
        {() => <ProtectedRoute component={FlowEditor} />}
      </Route>
      <Route path="/automation/campaigns">
        {() => <ProtectedRoute component={CampaignsPage} />}
      </Route>
      <Route path="/automation/segments">
        {() => <ProtectedRoute component={SegmentsPage} />}
      </Route>
      <Route path="/automation/analytics">
        {() => <ProtectedRoute component={AnalyticsPage} />}
      </Route>
      <Route path="/automation/interest">
        {() => <ProtectedRoute component={InterestLists} />}
      </Route>
      <Route path="/automation/leads">
        {() => <ProtectedRoute component={AutoLeads} />}
      </Route>
      <Route path="/automation/keywords">
        {() => <ProtectedRoute component={Keywords} />}
      </Route>
      <Route path="/automation/follow-up">
        {() => <ProtectedRoute component={FollowUp} />}
      </Route>
      <Route path="/automation/drip">
        {() => <ProtectedRoute component={Drip} />}
      </Route>
      <Route path="/automation/new-leads">
        {() => <ProtectedRoute component={NewLeads} />}
      </Route>

      {/* Apps */}
      <Route path="/apps/connect">
        {() => <ProtectedRoute component={ConnectApps} />}
      </Route>

      {/* Templates */}
      <Route path="/templates">
        {() => <ProtectedRoute component={Templates} />}
      </Route>
      <Route path="/templates/add">
        {() => <ProtectedRoute component={AddTemplate} />}
      </Route>
      <Route path="/templates/status">
        {() => <ProtectedRoute component={TemplateStatus} />}
      </Route>
      <Route path="/templates/manage">
        {() => <ProtectedRoute component={ManageTemplates} />}
      </Route>

      {/* AI */}
      <Route path="/ai">
        {() => <ProtectedRoute component={AgentsPage} />}
      </Route>
      <Route path="/ai/new">
        {() => <ProtectedRoute component={NewAgent} />}
      </Route>
      <Route path="/ai/manage">
        {() => <ProtectedRoute component={AgentsPage} />}
      </Route>
      <Route path="/ai/agents">
        {() => <ProtectedRoute component={AgentsPage} />}
      </Route>
      <Route path="/ai/map">
        {() => <ProtectedRoute component={MapAgent} />}
      </Route>
      <Route path="/ai/prefilled">
        {() => <ProtectedRoute component={PrefilledTextMappings} />}
      </Route>
      <Route path="/ai/reports">
        {() => <ProtectedRoute component={AgentReports} />}
      </Route>

      {/* Facebook */}
      <Route path="/facebook/forms">
        {() => <ProtectedRoute component={LeadForms} />}
      </Route>
      <Route path="/facebook/leads">
        {() => <ProtectedRoute component={Leads} />}
      </Route>

      {/* WhatsApp */}
      <Route path="/whatsapp/flows">
        {() => <ProtectedRoute component={WhatsAppFlowsPage} />}
      </Route>

      {/* Reports */}
      <Route path="/reports">
        {() => <ProtectedRoute component={DeliveryReport} />}
      </Route>
      <Route path="/reports/delivery">
        {() => <ProtectedRoute component={DeliveryReport} />}
      </Route>
      <Route path="/reports/campaign">
        {() => <ProtectedRoute component={CampaignPerformance} />}
      </Route>
      <Route path="/reports/replies">
        {() => <ProtectedRoute component={CustomerReplies} />}
      </Route>
      <Route path="/reports/agents">
        {() => <ProtectedRoute component={AgentPerformance} />}
      </Route>
      <Route path="/reports/spending">
        {() => <ProtectedRoute component={Spending} />}
      </Route>
      <Route path="/reports/credits">
        {() => <ProtectedRoute component={Credits} />}
      </Route>
      <Route path="/reports/user-engagement">
        {() => <ProtectedRoute component={UserEngagement} />}
      </Route>
      <Route path="/reports/broadcast">
        {() => <ProtectedRoute component={BroadcastReports} />}
      </Route>
      <Route path="/reports/blocked">
        {() => <ProtectedRoute component={BlockedContacts} />}
      </Route>
      <Route path="/reports/contacts">
        {() => <ProtectedRoute component={ContactReports} />}
      </Route>
      <Route path="/reports/lead-assignments">
        {() => <ProtectedRoute component={LeadAssignmentReports} />}
      </Route>
      <Route path="/reports/user-activity">
        {() => <ProtectedRoute component={UserActivityReports} />}
      </Route>

      <Route path="/contacts">
        {() => <ProtectedRoute component={Contacts} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/whatsapptokens">
        {() => <ProtectedRoute component={WhatsTokenCardMain} />}
      </Route>

      <Route path="/usagedashboard">
        {() => <ProtectedRoute component={AiUsageDashboard} />}
      </Route>

      <Route path="/create-whatsappflow">
        {() => <ProtectedRoute component={WhatsAppFlowBuilder} />}
      </Route>
      <Route path="/create-whatsappflow/:id">
        {() => <ProtectedRoute component={WhatsAppFlowBuilder} />}
      </Route>

      <Route path="/report-dripcampaign">
        {() => <ProtectedRoute component={DripCampaignReport} />}
      </Route>

      <Route path="/contactusagedashboard">
        {() => <ProtectedRoute component={ContactUsageDetail} />}
      </Route>
      <Route path="/settings/profile">
        {() => <ProtectedRoute component={ProfileDetails} />}
      </Route>
      <Route path="/settings/api">
        {() => <ProtectedRoute component={WebhookAPI} />}
      </Route>
      <Route path="/settings/webhook-events">
        {() => <ProtectedRoute component={WebhookEvents} />}
      </Route>
      <Route path="/settings/billing">
        {() => <ProtectedRoute component={Billing} />}
      </Route>

      <Route path="/aitokens">
        {() => <ProtectedRoute component={TokenCardMain} />}
      </Route>
      <Route path="/whatsapptokens">
        {() => <ProtectedRoute component={WhatsTokenCardMain} />}
      </Route>
      {/* User Management */}
      <Route path="/user-management">
        {() => <ProtectedRoute component={UserManagement} />}
      </Route>

      <Route path="/user-management-dashboard">
        {() => <ProtectedRoute component={UserManagementDashboard} />}
      </Route>

      <Route path="/fblead-automation-report">
        {() => <ProtectedRoute component={FBLeadAutomationReport} />}
      </Route>

      <Route path="/campaigns/past">
        {() => <ProtectedRoute component={Single} />}
      </Route>

      <Route path="/register">
        {() => {
          const { isAuthenticated } = useAuth();
          return isAuthenticated ? <Redirect to="/" /> : <Register />;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch >
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

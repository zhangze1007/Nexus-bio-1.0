'use client';
import React from 'react';
import { THEME } from '../../theme';
import { toolTokens } from '../../hooks/useToolTheme';
import { DEFAULT_PARAMS } from '../../data/mockDynCon';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ScientificHero from './shared/ScientificHero';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import WorkflowStepper from './shared/WorkflowStepper';
import ResultSummaryPanel from './shared/ResultSummaryPanel';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import ExportButton from '../ide/shared/ExportButton';
import NextStepButton from '../NextStepButton';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';

import { useDynConState } from './dyncon/useDynConState';
import { DYNCON_TABS, FrontierEngineBadge, DigitalTwinPanel, BioreactorAnalyticsPanel } from './dyncon/sharedComponents';
import { TrajectoryPanel, BioprocessOptimizationPanel } from './dyncon/BioreactorSim';
import { HillCurvePanel } from './dyncon/HillFeedback';
import { ConvergencePanel, RBSBridgePanel } from './dyncon/ConvergenceAnalysis';

const { label: LABEL, value: VALUE } = toolTokens;

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default React.memo(function DynConPage() {
  const state = useDynConState();
  const {
    activeTab, setActiveTab,
    workflowStep, setWorkflowStep,
    controlMode, setpoint,
    productTiter, productivity, doRmse,
    convergence, burden, rbsMapping,
    hill, vmax, hillKd, hillN,
    currentFPP, currentADS,
    trajectory, simError,
    mpcResult, mpcPredHorizon, mpcCtrlHorizon,
    kp, ki, kd,
    chartRef, fbaPayload, cethxPayload, last,
  } = state;

  return (
    <ToolShell
      moduleId="dyncon"
      title="Dynamic Control Simulator"
      description={`Fed-batch bioreactor with ${controlMode === 'mpc' ? 'MPC (Model Predictive Control)' : 'PID-controlled'} DO₂ and Hill-function negative feedback`}
      formula="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n)"
      tabs={DYNCON_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['convergence', 'rbs']}
      footer={
        <>
          <DataSourceBadge source={fbaPayload || cethxPayload ? 'live' : 'mock'} label={fbaPayload || cethxPayload ? 'Upstream Data' : 'Default Params'} />
          <ExportButton label="Export JSON" data={trajectory} filename="dyncon-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="dyncon-trajectory" format="csv" />
          <ExportButton label="Export SVG" data={null} filename="dyncon-chart" format="svg" svgRef={chartRef} />
        </>
      }
      hero={
        <>
          <FrontierEngineBadge engineId="digitaltwin" />
          <ScientificHero
            eyebrow="Stage 3 · Chassis Control"
            title="Controller behavior is tied to the current metabolic burden"
            summary="DYNCON turns pathway risk into operating policy. PID tuning, Hill repression, and genetic-part mapping are treated as one control package so the page behaves like a scientific control surface for a living system, not a disconnected slider set."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Control bridge
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 700 }}>
                  {rbsMapping.rbsName} · gain {rbsMapping.controlGain.toFixed(2)}
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.55 }}>
                  Controller gains are translated into a concrete RBS choice, so the workbench keeps one foot in executable biology.
                </div>
              </>
            }
            signals={[
              {
                label: 'Product Titer',
                value: `${productTiter.toFixed(2)} g/L`,
                detail: `${productivity.toFixed(2)} g/L/h productivity under the current controller settings.`,
                tone: productTiter > 10 ? 'cool' : 'warm',
              },
              {
                label: 'Control Stability',
                value: convergence.isStable ? 'Stable' : 'Unstable',
                detail: `DO₂ RMSE ${doRmse.toFixed(3)} against setpoint ${setpoint.toFixed(2)}`,
                tone: convergence.isStable ? 'cool' : 'alert',
              },
              {
                label: 'Burden Index',
                value: burden.burdenIndex.toFixed(2),
                detail: `Current FPP ${currentFPP.toFixed(2)} μM · ADS expression ${currentADS.toFixed(2)}`,
                tone: burden.burdenIndex < 0.45 ? 'cool' : 'warm',
              },
              {
                label: 'Repression Curve',
                value: `Vmax ${vmax.toFixed(2)} · n ${hillN.toFixed(1)}`,
                detail: `Hill Kd ${hillKd.toFixed(1)} μM defines how quickly repression engages as pathway pressure rises.`,
                tone: 'neutral',
              },
            ]}
          />
        </>
      }
    >
      {simError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <SimErrorBanner message={simError} />
        </div>
      ) : (
        <>
          {/* ── Workflow Stepper ── */}
          <div style={{ padding: '8px 16px 0' }}>
            <WorkflowStepper
              steps={[
                { id: 'setup', label: 'Setup', status: workflowStep > 0 ? 'done' : workflowStep === 0 ? 'active' : 'pending', detail: 'Controller params' },
                { id: 'simulate', label: 'Simulate', status: workflowStep > 1 ? 'done' : workflowStep === 1 ? 'active' : 'pending', detail: controlMode === 'mpc' ? 'MPC' : 'RK4 ODE' },
                { id: 'optimize', label: 'Optimize', status: workflowStep > 2 ? 'done' : workflowStep === 2 ? 'active' : 'pending', detail: 'Tune gains' },
                { id: 'analyze', label: 'Analyze', status: workflowStep > 3 ? 'done' : workflowStep === 3 ? 'active' : 'pending', detail: 'Convergence' },
              ]}
              activeIndex={workflowStep}
              onStepClick={setWorkflowStep}
            />
          </div>

          {/* ── Result Summary ── */}
          <div style={{ padding: '0 16px 8px' }}>
            <ResultSummaryPanel
              metrics={[
                { label: 'Convergence', value: convergence.isStable ? 'Stable' : 'Unstable', accent: convergence.isStable ? THEME.MINT : THEME.CORAL },
                { label: 'Growth Rate', value: (last?.biomass ?? 0).toFixed(2), unit: 'g/L', accent: THEME.SKY },
                { label: 'Productivity', value: productivity.toFixed(2), unit: 'g/L/h', accent: THEME.MINT },
                { label: 'Stability', value: doRmse.toFixed(3), unit: 'RMSE', accent: doRmse > 0.1 ? THEME.CORAL : THEME.SKY, trend: doRmse > 0.1 ? 'down' : 'flat' },
              ]}
            />
          </div>

          {/* ── Algorithm Transparency ── */}
          <div style={{ padding: '8px 16px' }}>
            <AlgorithmPanel
              name={controlMode === 'mpc' ? 'Euler Discrete + MPC (Projected QP)' : 'RK4 ODE + PID Control'}
              description={controlMode === 'mpc'
                ? 'Model Predictive Control with online linearisation and quadratic programming. At each timestep the nonlinear bioreactor model is linearised via finite-difference Jacobians, a QP is solved over the prediction horizon, and the first optimal control signal is applied.'
                : 'Simulates dynamic bioreactor control using 4th-order Runge-Kutta integration. PID controller adjusts feed rate to maintain setpoint. Hill functions model feedback inhibition.'}
              assumptions={[
                'Well-mixed bioreactor (CSTR model)',
                'Instantaneous mixing (no transport delays)',
                'Monod kinetics for substrate uptake',
                'Hill function for product inhibition',
                ...(controlMode === 'mpc'
                  ? [
                      'Linearised state-space model per timestep',
                      'Quadratic cost: state error + control effort',
                      'Box constraints on states and controls',
                      'Projected gradient descent QP solver',
                    ]
                  : ['PID controller with anti-windup']
                ),
              ]}
              limitations={[
                'No discrete event modeling (e.g., batch transitions)',
                'Simplified metabolic network (6 species)',
                'No stochastic effects',
                ...(controlMode === 'mpc'
                  ? [
                      'Euler integration (1h step) — less accurate than RK4',
                      'QP solved by gradient descent (not a commercial solver)',
                      'Linearisation may diverge far from operating point',
                    ]
                  : ['Controller tuning is manual']
                ),
              ]}
              citation={controlMode === 'mpc'
                ? {
                    authors: 'Camacho EF, Bordons C',
                    title: 'Model Predictive Control',
                    journal: 'Springer',
                    year: 2007,
                    doi: '10.1007/978-0-85729-398-5',
                  }
                : {
                    authors: 'Bailey JE, Ollis DF',
                    title: 'Biochemical Engineering Fundamentals',
                    journal: 'McGraw-Hill',
                    year: 1986,
                    doi: '',
                  }
              }
            />
          </div>

          {/* ── Trajectory Tab ── */}
          <ToolTabPanel tabId="trajectory" activeId={activeTab}>
            <TrajectoryPanel state={state} />
          </ToolTabPanel>

          {/* ── Hill Curve Tab ── */}
          <ToolTabPanel tabId="hill" activeId={activeTab}>
            <HillCurvePanel state={state} />
          </ToolTabPanel>

          {/* ── Convergence Tab ── */}
          <ToolTabPanel tabId="convergence" activeId={activeTab}>
            <ConvergencePanel state={state} />
          </ToolTabPanel>

          {/* ── RBS Bridge Tab ── */}
          <ToolTabPanel tabId="rbs" activeId={activeTab}>
            <RBSBridgePanel state={state} />
          </ToolTabPanel>
        </>
      )}

      {/* ── Bioprocess Optimization Tab ─────────────────────────────── */}
      <ToolTabPanel tabId="bioprocess" activeId={activeTab}>
        <BioprocessOptimizationPanel />
      </ToolTabPanel>

      {/* ── Digital Twin Tab ──────────────────────────────────────────── */}
      <ToolTabPanel tabId="digitaltwin" activeId={activeTab}>
        <DigitalTwinPanel />
      </ToolTabPanel>

      {/* ── Bioreactor Analytics Tab ────────────────────────────────────── */}
      <ToolTabPanel tabId="analytics" activeId={activeTab}>
        <BioreactorAnalyticsPanel />
      </ToolTabPanel>
      <NextStepButton currentStepId="dyncon" />
    </ToolShell>
  );
});

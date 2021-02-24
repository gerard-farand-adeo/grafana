import React, { FC } from 'react';
import { DisplayValue, FALLBACK_COLOR, formattedValueToString, GrafanaTheme } from '@grafana/data';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';
import { css } from 'emotion';
import { VizLegend, VizLegendItem } from '..';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/types';

export enum PieChartLabels {
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

interface SvgProps {
  height: number;
  width: number;
  values: DisplayValue[];
  pieType: PieChartType;
  labelOptions?: PieChartLabelOptions;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
}
export interface Props extends SvgProps {
  legendOptions?: PieChartLegendOptions;
}

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export interface PieChartLabelOptions {
  showName?: boolean;
  showValue?: boolean;
  showPercent?: boolean;
}

export interface PieChartLegendOptions extends VizLegendOptions {
  showPercent?: boolean;
  showValue?: boolean;
}

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  placement: 'right',
  calcs: [],
  showPercent: true,
};

export const PieChart: FC<Props> = ({ values, legendOptions = defaultLegendOptions, width, height, ...restProps }) => {
  const getLegend = (values: DisplayValue[], legendOptions: PieChartLegendOptions) => {
    if (legendOptions.displayMode === LegendDisplayMode.Hidden) {
      return undefined;
    }
    const total = values.reduce((acc, item) => item.numeric + acc, 0);

    const legendItems = values.map<VizLegendItem>((value) => {
      return {
        label: value.title ?? '',
        color: value.color ?? FALLBACK_COLOR,
        yAxis: 1,
        getDisplayValues: () => {
          let displayValues = [];
          if (legendOptions.showPercent) {
            const fractionOfTotal = value.numeric / total;
            const percentOfTotal = fractionOfTotal * 100;
            displayValues.push({
              numeric: fractionOfTotal,
              percent: percentOfTotal,
              text: percentOfTotal.toFixed(0) + '%',
            });
          }
          if (legendOptions.showValue) {
            displayValues.push({ numeric: value.numeric, text: formattedValueToString(value) });
          }
          return displayValues;
        },
      };
    });

    return (
      <VizLegend items={legendItems} placement={legendOptions.placement} displayMode={legendOptions.displayMode} />
    );
  };

  return (
    <VizLayout width={width} height={height} legend={getLegend(values, legendOptions)}>
      {(vizWidth: number, vizHeight: number) => {
        return <PieChartSvg width={vizWidth} height={vizHeight} values={values} {...restProps} />;
      }}
    </VizLayout>
  );
};

export const PieChartSvg: FC<SvgProps> = ({
  values,
  pieType,
  width,
  height,
  useGradients = true,
  labelOptions = { showName: true },
}) => {
  const theme = useTheme();
  const componentInstanceId = useComponentInstanceId('PieChart');
  const styles = useStyles(getStyles);
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<DisplayValue>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  if (values.length < 0) {
    return <div>No data</div>;
  }

  const getValue = (d: DisplayValue) => d.numeric;
  const getGradientId = (color: string) => `${componentInstanceId}-${color}`;
  const getGradientColor = (color: string) => {
    return `url(#${getGradientId(color)})`;
  };

  const onMouseMoveOverArc = (event: any, datum: any) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    showTooltip({
      tooltipLeft: coords!.x,
      tooltipTop: coords!.y,
      tooltipData: datum,
    });
  };

  const showLabel = labelOptions.showName || labelOptions.showPercent || labelOptions.showValue;
  const total = values.reduce((acc, item) => item.numeric + acc, 0);
  const layout = getPieLayout(width, height, pieType);

  return (
    <div className={styles.container}>
      <svg width={layout.size} height={layout.size} ref={containerRef}>
        <Group top={layout.position} left={layout.position}>
          {values.map((value) => {
            const color = value.color ?? FALLBACK_COLOR;
            return (
              <RadialGradient
                key={value.color}
                id={getGradientId(color)}
                from={getGradientColorFrom(color, theme)}
                to={getGradientColorTo(color, theme)}
                fromOffset={layout.gradientFromOffset}
                toOffset="1"
                gradientUnits="userSpaceOnUse"
                cx={0}
                cy={0}
                radius={layout.outerRadius}
              />
            );
          })}
          <Pie
            data={values}
            pieValue={getValue}
            outerRadius={layout.outerRadius}
            innerRadius={layout.innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => {
              return pie.arcs.map((arc) => {
                return (
                  <g
                    key={arc.data.title}
                    className={styles.svgArg}
                    onMouseMove={(event) => onMouseMoveOverArc(event, arc.data)}
                    onMouseOut={hideTooltip}
                  >
                    <path
                      d={pie.path({ ...arc })!}
                      fill={useGradients ? getGradientColor(arc.data.color ?? FALLBACK_COLOR) : arc.data.color}
                      stroke={theme.colors.panelBg}
                      strokeWidth={1}
                    />
                    {showLabel && (
                      <PieLabel
                        arc={arc}
                        outerRadius={layout.outerRadius}
                        innerRadius={layout.innerRadius}
                        labelOptions={labelOptions}
                        total={total}
                      />
                    )}
                  </g>
                );
              });
            }}
          </Pie>
        </Group>
      </svg>
      {tooltipOpen && (
        <TooltipInPortal key={Math.random()} top={tooltipTop} left={tooltipLeft}>
          {tooltipData!.title} {formattedValueToString(tooltipData!)}
        </TooltipInPortal>
      )}
    </div>
  );
};

const PieLabel: FC<{
  arc: PieArcDatum<DisplayValue>;
  outerRadius: number;
  innerRadius: number;
  labelOptions: PieChartLabelOptions;
  total: number;
}> = ({ arc, outerRadius, innerRadius, labelOptions, total }) => {
  const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
  const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
  const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;

  if (!hasSpaceForLabel) {
    return null;
  }

  let labelFontSize = labelOptions.showName
    ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
    : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);

  return (
    <g>
      <text
        fill="white"
        x={labelX}
        y={labelY}
        dy=".33em"
        fontSize={labelFontSize}
        textAnchor="middle"
        pointerEvents="none"
      >
        {labelOptions.showName && (
          <tspan x={labelX} dy="1.2em">
            {arc.data.title}
          </tspan>
        )}
        {labelOptions.showValue && (
          <tspan x={labelX} dy="1.2em">
            {formattedValueToString(arc.data)}
          </tspan>
        )}
        {labelOptions.showPercent && (
          <tspan x={labelX} dy="1.2em">
            {((arc.data.numeric / total) * 100).toFixed(0) + '%'}
          </tspan>
        )}
      </text>
    </g>
  );
};

function getLabelPos(arc: PieArcDatum<DisplayValue>, outerRadius: number, innerRadius: number) {
  const r = (outerRadius + innerRadius) / 2;
  const a = (+arc.startAngle + +arc.endAngle) / 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function getGradientColorFrom(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(20 * (theme.isDark ? 1 : -0.7))
    .spin(8)
    .toRgbString();
}

function getGradientColorTo(color: string, theme: GrafanaTheme) {
  return tinycolor(color)
    .darken(10 * (theme.isDark ? 1 : -0.7))
    .spin(-8)
    .toRgbString();
}

interface PieLayout {
  position: number;
  size: number;
  outerRadius: number;
  innerRadius: number;
  gradientFromOffset: number;
}

function getPieLayout(height: number, width: number, pieType: PieChartType, margin = 16): PieLayout {
  const size = Math.min(width, height);
  const outerRadius = (size - margin * 2) / 2;
  const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
  const innerRadius = outerRadius - donutThickness;
  const centerOffset = (size - margin * 2) / 2;
  // for non donut pie charts shift gradient out a bit
  const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
  return {
    position: centerOffset + margin,
    size: size,
    outerRadius: outerRadius,
    innerRadius: innerRadius,
    gradientFromOffset: gradientFromOffset,
  };
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    svgArg: css`
      transition: all 200ms ease-in-out;
      &:hover {
        transform: scale3d(1.03, 1.03, 1);
      }
    `,
  };
};

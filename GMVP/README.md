# Global Minimum Variance Portfolio
<p>But before that, let's understand a more general concept</p>

## The Minimum Variance Frontier
<p>
Let's clarify what a financial portfolio means. <br/>
It is a collection of investments such as stocks, bonds, commodities, cash, and cash equivalents. <br/>
Given a selection of these assets, one of the first questions we might have is: <br/>
"How can we combine these assets to minimise risk and maximise gains?"<br/>
This is a core concept in portfolio theory!<br/>
The minimum variance frontier refers to the set of portfolios that have the best risk-to-reward ratios.<br/>
Ok, how do we measure reward and risk?
We will demonstrate with 3 fictitious stocks, A, B and C with weekly prices:

<table border="1" width="90%">
<thead> <tr><th>Date</th><th>A</th><th>B</th><th>C</th></tr> </thead>
<tbody> 
<tr><td>2025-01-03</td><td>100.00</td><td>50.00</td><td>80.00</td></tr> <tr><td>2025-01-10</td><td>101.50</td><td>49.80</td><td>81.20</td></tr> <tr><td>2025-01-17</td><td>102.80</td><td>50.50</td><td>80.60</td></tr> <tr><td>2025-01-24</td><td>102.00</td><td>51.20</td><td>81.00</td></tr> <tr><td>2025-01-31</td><td>103.20</td><td>50.90</td><td>82.40</td></tr> <tr><td>2025-02-07</td><td>104.00</td><td>51.80</td><td>83.10</td></tr> <tr><td>2025-02-14</td><td>103.60</td><td>52.40</td><td>84.00</td></tr> <tr><td>2025-02-21</td><td>105.20</td><td>52.10</td><td>83.20</td></tr> <tr><td>2025-02-28</td><td>106.00</td><td>53.00</td><td>84.50</td></tr> <tr><td>2025-03-07</td><td>105.50</td><td>53.80</td><td>85.00</td></tr> <tr><td>2025-03-14</td><td>106.80</td><td>53.20</td><td>84.40</td></tr> <tr><td>2025-03-21</td><td>108.10</td><td>54.00</td><td>85.70</td></tr> <tr><td>2025-03-28</td><td>109.00</td><td>55.10</td><td>86.90</td></tr>
</tbody></table>
</p>

### Risk and Reward
<p>
Rewards simply refers to the mean return of the asset over a given time series. <br/>
The return over a single time period is given as: <br/>

$R = \frac{P_{t} - P_{t-1}}{P_{t-1}}$ <br/><br/>
Where P refers to the closing price of the asset for said time period. <br/>
The return of stock A on the first week is thus $=\frac{101.50 - 100.00}{100.00}=0.015$

Then, the mean return over the time series is simply the average of the total returns over each period. <br/>
If we look at weekly returns, we take the closing price of this Friday, and the closing price of last week's Friday. <br/><br/>
$μ = \frac{1}{n} \sum_{i=1}^{n} R_{i}$ <br/>

Expected returns for stock A is thus 0.00723734<br/>
</p>
<p>
Risk or volatility refers to an asset/portfolio's standard deviation. <br/>
It measures how much the returns have varied from their average.<br/>

$σ=\sqrt{\frac{1}{n-1} \sum_{i=1}^{n} {(R_{i}-μ)^2}}$ <br/>
For stock A this is $=\sqrt{\frac{1}{12-1} \sum_{i=1}^{n} {(R_{i}-0.00723734)^2}} = 0.00810311$
> **Note:**<br/>
> This is the formula for __sample__ variance. <br/>
> It is used since we are looking at a part of historical data. <br/>
> Variance is the square of standard deviation. <br/>

This gives the volatity of that time period i.e. daily, weekly. <br/>
We annualise the standard deviation for a more macro-level view and intuitive understanding.<br/>
To do so, we multiply σ with the sqrt of the amount of trading periods in a year. <br/>
i.e. $σ_{annual}^{2} = σ_{daily}^{2} × 252$ <br/>

> **Note:**<br/>
> This only works because we assume independence of returns (random walk);<br/>
> the movement of ystd's prices does not affect today's movement<br/>
> then the variance over a longer period is the sum of the variances of the individual daily periods.<br/>
</p>

<p>
Why is risk measured by standard deviation? <br/>
A lower standard deviation means the asset's movement is slightly more predictable. <br/>
Interestingly, assets with lower volatility have, historically, a higher probability of higher returns (low volatility anomaly). <br/>
This is, however, just an observation and not central to this discussion.
</p>

<p>
Now, try and calculate the expected returns and standard deviation for each stock. 
<table border="1">
<thead><tr><th>Asset</th><th>μ (weekly mean)</th><th>σ (weekly stdev)</th><th>σ annualized (√52 × σ)</th></tr></thead> 
<tbody> 
<tr><td>A</td><td>0.007237337635325386</td><td>0.008103107709917668</td><td>0.05843234067743146</td></tr> 
<tr><td>B</td><td>0.008185178787640765</td><td>0.01131119128677821</td><td>0.08156616034212068</td></tr> 
<tr><td>C</td><td>0.006962311815593804</td><td>0.00983379210687762</td><td>0.07091248334720063</td></tr> 
</tbody></table>
</p>
<p>
We looked at the calculations for a single asset. <br/>
Now let's look at how we can calulate these for a portfolio.
</p>

## Portfolio calulation
<p>
In a portfolio, we will have multiple assets with multiple weights. <br/>

Let's look at a 2-asset portfolio first, with assets A and B with weights $w_{A}$ and $w_{B}$ respectively. <br/>

> **Note:**<br/>
> Weights refer to proportion of portfolio asset takes<br/>
> Weights must sum to 1
</p>

### Portfolio average returns
<p>

Average return is simply $R = \sum_{i=1}^{n} w_{i}×R_{i}$<br/>

Which $=w_{A}×R_{A}+w_{B}×R_{B}$ for 2-asset portfolios. <br/>
Giving our assets A and B arbitrary weights of 0.4 and 0.6 respectively, average returns $=0.4*0.00723734 + 0.6*0.00818518=0.007806044$
</p>

### Portfolio volatility
<p>
Here's where things get tricky; <br/>
Portfolio volatility is not just the weighted sum of all asset volatilities. <br/>
Recall that variance measures how much the asset varies from average returns. <br/>
Some assets are correlated. <br/>
For example, stocks in the same sector, will face the same sector risks, and a shock in that sector will cause price movements in the same direction for both stocks. <br/>
Banks are a good example, where thier stocks almost move in sync. <br/>
In such a senario, simply summing up their volatility would imply a much higher risk than there is. <br/>
One way to calculate the portfolio variance is to sum the weighted returns over each time period to obtain a new series. <br/>
We can then calculate variance like it is a singular asset. <br/>

Mathematically, $Var(R_{p}) = Var(\sum_{i=1}^{n}w_{i}R_{i})$ 

To expand this expression, we look at the covariance between assets. <br/>
Covariance is a measure of how related two variables are. <br/>

Matematically, $Cov(X,Y)=σ_{X,Y}=E(XY)-E(X)E(Y)$, and <br/>
$Var(aX + bY)=a^{2}Var(X) + b^{2}Var(Y) + 2abCov(X,Y)$, and (note that this is the variance for 2 asset portfolio)<br/>
$Cov(aX + bY, Z)=aCov(X, Z) + bCov(Y, Z)$. <br/>

From Var(aX + bY), and <br/>
$σ_A^2 = 0.00006566$<br/>
$σ_B^2 = 0.00012794$<br/>
$Cov(A,B) = -0.00004438$<br/>
We obtain, $Var(R_p) = 0.4^2(0.00006566) + 0.6^2(0.00012794) + 2(0.4)(0.6)(-0.00004438) = 0.00003526$.<br/>
Thus, $σ_p = 0.00594$ (weekly).


Then, portfolio vairance is
$$\begin{aligned}
\\ &Cov(\sum_{i=1}^{n}w_{i}R_{i},\sum_{j=1}^{n}w_{j}R_{j}) &&
\\  =&\sum_{i=1}^{n}\sum_{j=1}^{n}w_{i}w_{j}σ_{i, j} &&
\\ =&\sum_{i=1}^{n}w_{i}^{2}σ_{i}^{2}+\sum_{i=1}^{n}\sum_{j≠i}w_{i}w_{j}σ_{i, j} && \text{as} & σ_{i,i} = σ_{i}^{2} 
\\ =&\sum_{i=1}^{n}w_{i}^{2}σ_{i}^{2}+2\sum_{i=1}^{n}\sum_{j<i}w_{i}w_{j}σ_{i, j} && \text{as} & σ_{i,j} = σ_{j,i}
\end{aligned}$$

> **Note:**<br/>
> From this, we can also prove that a well diversified portfolio can:<br/>
> minimise idosyncratic risk,<br/>
> but not totally eliminate systematic risks
</p>

<p>
Thus, by iterating through all possible combinations of weights, we can determine the minimum variance for each return.<br/>

In a 2-asset portfolio, the minimum variance occurs where weight of first asset is $\frac{σ_{2}(σ_{2}-ρ_{1,2}σ_{1})}{σ_{1}^{2}+σ_{2}^{2}-2ρ_{1,2}σ_{1}σ_{2}}$ <br/>

Solving for asset A and B, we get a the weight of 0.610289 for A and 1-0.610289=0.389711 for B.
</p>

## Solving for multiple assets
<p>
With more than 2 assets, we no longer have a simple equation to solve for.<br/>

Recall that portfolio variance is $=\sum_{i=1}^{n}w_{i}^{2}σ_{i}^{2}+2\sum_{i=1}^{n}\sum_{j<i}w_{i}w_{j}σ_{i, j}$ <br/>

Notice how the weights are quadratic. <br/>
Conveniently, it is a common mathematical problem to optimize (minimize or maximize) a multivariate quadratic function subject to linear constraints on variables. <br/>
This is known as Quadratic programming, which aims to:
$$\begin{aligned}
& {\text{minimize}} & & \frac{1}{2} \mathbf{w}^\top \mathbf{Q} \mathbf{w} + \mathbf{c}^\top \mathbf{w} \\
& \text{subject to} & & \mathbf{A}^\top \mathbf{w} = \mathbf{b} \\
& & & \mathbf{G} \mathbf{w} \leq \mathbf{h}
\end{aligned}$$
These are represented in matrices. <br/>

Looking at portfolio variance in matrix representation, we are actually minimising:<br/>
$\begin{bmatrix} w_1 & w_2 & \cdots & w_n \end{bmatrix} \begin{bmatrix} \sigma_{1,1} & \sigma_{1,2} & \cdots & \sigma_{1,n} \\ \sigma_{2,1} & \sigma_{2,2} & \cdots & \sigma_{2,n} \\ \vdots & \vdots & \ddots & \vdots \\ \sigma_{n,1} & \sigma_{n,2} & \cdots & \sigma_{n,n} \end{bmatrix} \begin{bmatrix} w_1 \\ w_2 \\ \vdots \\ w_n \end{bmatrix}$<br/><br/>
Subject to sum of weights being 1: <br/>
$\begin{bmatrix} 1 & 1 & \cdots & 1 \end{bmatrix} \begin{bmatrix} w_1 \\ w_2 \\ \vdots \\ w_n \end{bmatrix} = 1$ <br/><br/>
And non-negativity of weights (if short-selling is disabled): <br/>
$\mathbf{w} \geq 0$ <br/>

In standard matrix notation,
$$\begin{aligned} & {\text{minimize}} & & \frac{1}{2} \mathbf{w}^\top \mathbf{\Sigma} \mathbf{w} \\ & \text{subject to} & & \mathbf{1}^\top \mathbf{w} = 1 \\ & & & \mathbf{w} \geq 0 \end{aligned}$$
Where w is a column vector of weights, and Σ is the covariance matrix. <br/><br/>
Looks familiar? <br/>
This is because the problem of minimum portfolio variance is in the exact form of a quadratic function! <br/>
We simply need to plug it into a solver to get the answer. <br/>

Using a solver, we need to first find the covariance matrix Σ:
<table border="1">
<thead><tr><th></th><th>A</th><th>B</th><th>C</th></tr></thead>
<tbody>
<tr><td>A</td><td>0.00006566</td><td>-0.00004438</td><td>0.00002135</td></tr>
<tr><td>B</td><td>-0.00004438</td><td>0.00012794</td><td>0.00005682</td></tr> 
<tr><td>C</td><td>0.00002135</td><td>0.00005682</td><td>0.00009672</td></tr> 
</tbody></table>

The weights are approximately: $w_{A} = 0.52, w_{B} = 0.28, w_{C} = 0.20$ <br/>
Calculating expected returns of individual assets = [0.00723734, 0.00818518, 0.00696231], we thus get <br/>
Portfolio expected return = $0.52(0.00724) + 0.28(0.00819) + 0.20(0.00696) = 0.00756$. <br/>
Knowing the weights and covariance matrix, we can calculate portfolio variance = 0.0000319 <br/>
so, $σ_{p} = 0.00565 (weekly)$ and Annualized volatility = 0.0407. 
</p>

##### TODO:
<ul>
<li>Graphs</li>
<li>Tangency portfolio</li>
<ul>
    <li>Sharpe ratio</li>
    <li>CML</li>
</ul>
</ul>
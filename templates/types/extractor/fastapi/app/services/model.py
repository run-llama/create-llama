IMPORTS = """
from llama_index.core.schema import BaseModel, Field
from typing import List, Optional
from datetime import date
"""

DEFAULT_MODEL = """class CompanyFinancialReport(BaseModel):
    '''
    The financial report of a company:
    + Always use the context data and do not make up any information yourself.
    + Return a null value if it is not available in the context.
    '''
    
    revenue: Optional[str] = Field(default=None, description="The revenue of the company.")
    EPS: Optional[str] = Field(default=None, description="The Earnings Per Share (EPS) of the company.")
    net_income: Optional[str] = Field(default=None, description="The net income of the company.")
    free_cash_flow: Optional[str] = Field(default=None, description="The free cash flow of the company.")
    ROE: Optional[str] = Field(default=None, description="The Return on Equity (ROE) of the company.")
    ROA: Optional[str] = Field(default=None, description="The Return on Assets (ROA) of the company.")
    debt_to_equity: Optional[str] = Field(default=None, description="The debt-to-equity ratio of the company.")
    gross_margin: Optional[str] = Field(default=None, description="The gross margin of the company.")
    operating_margin: Optional[str] = Field(default=None, description="The operating margin of the company.")
    net_profit_margin: Optional[str] = Field(default=None, description="The net profit margin of the company.")
    market_cap: Optional[str] = Field(default=None, description="The market capitalization of the company.")
    net_margin: Optional[str] = Field(default=None, description="The net margin of the company.")
    income_tax_expense: Optional[str] = Field(default=None, description="The income tax expense of the company.")
"""

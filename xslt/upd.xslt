<?xml version="1.0" encoding="UTF-8"?>
<!--
  Печатная форма «Универсальный передаточный документ» для XML УПД формата 5.03
  (приказ ФНС ЕД-7-26/970@), титул продавца. Раскладка — по рекомендованной форме УПД:
  статус 1/2, шапка с графами 1–8, таблица 1–11, нижняя часть 8–14 (продавец)
  и 15–19 (покупатель, пустые — заполняются в титуле покупателя).

  XSLT 1.0: работает в libxslt (lxml, xslt-polyfill). Общие шаблоны — в common.xslt.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:include href="common.xslt"/>

  <xsl:output method="html" encoding="UTF-8" indent="no"/>

  <!-- Атрибуты корня читаем только через $file: libxml2 не парсит «/Файл/@Атр». -->
  <xsl:variable name="file" select="/Файл"/>
  <xsl:variable name="doc" select="$file/Документ"/>
  <xsl:variable name="hdr" select="$doc/СвСчФакт"/>
  <xsl:variable name="table" select="$doc/ТаблСчФакт"/>
  <xsl:variable name="per" select="$doc/СвПродПер/СвПер"/>
  <xsl:variable name="fn" select="$doc/@Функция"/>
  <xsl:variable name="seller" select="$hdr/СвПрод[1]"/>
  <xsl:variable name="buyer" select="$hdr/СвПокуп[1]"/>
  <xsl:variable name="signer" select="$doc/Подписант[1]"/>

  <!-- ================================================================ страница -->

  <xsl:template match="/">
    <html lang="ru">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>
          <xsl:text>УПД № </xsl:text>
          <xsl:value-of select="$hdr/@НомерДок"/>
          <xsl:text> от </xsl:text>
          <xsl:value-of select="$hdr/@ДатаДок"/>
        </title>
        <style><xsl:call-template name="css"/></style>
      </head>
      <body>
        <xsl:choose>
          <xsl:when test="not($hdr)">
            <p class="error">Это не файл УПД: нет элемента Файл/Документ/СвСчФакт.</p>
          </xsl:when>
          <xsl:otherwise>
            <xsl:call-template name="upd"/>
          </xsl:otherwise>
        </xsl:choose>
      </body>
    </html>
  </xsl:template>

  <xsl:template name="upd">
    <article class="page upd">
      <table class="head">
        <tr>
          <td class="status-box" rowspan="2">
            <div class="doc-title">Универсальный передаточный документ</div>
            <div class="status">
              <span>Статус:</span>
              <b class="status-val">
                <xsl:choose>
                  <xsl:when test="$fn = 'СЧФДОП'">1</xsl:when>
                  <xsl:when test="$fn = 'ДОП'">2</xsl:when>
                  <xsl:otherwise>—</xsl:otherwise>
                </xsl:choose>
              </b>
            </div>
            <div class="status-hint">
              1 — счет-фактура и передаточный документ (акт)<br/>
              2 — передаточный документ (акт)
            </div>
          </td>
          <td class="head-main">
            <table class="fields">
              <tr class="big">
                <th>Счет-фактура №</th>
                <td class="v">
                  <b><xsl:value-of select="$hdr/@НомерДок"/></b>
                  <xsl:text> от </xsl:text>
                  <b><xsl:value-of select="$hdr/@ДатаДок"/></b>
                </td>
                <td class="g">(1)</td>
              </tr>
              <tr>
                <th>Исправление №</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/ИспрДок">
                      <xsl:value-of select="$hdr/ИспрДок/@НомИспр"/>
                      <xsl:text> от </xsl:text>
                      <xsl:value-of select="$hdr/ИспрДок/@ДатаИспр"/>
                    </xsl:when>
                    <xsl:otherwise>— от —</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(1а)</td>
              </tr>
            </table>
            <xsl:if test="$doc/@НаимДокОпр">
              <div class="doc-kind"><xsl:value-of select="$doc/@НаимДокОпр"/></div>
            </xsl:if>
          </td>
        </tr>
        <tr>
          <td class="head-main">
            <table class="fields">
              <tr>
                <th>Продавец</th>
                <td class="v"><xsl:apply-templates select="$seller/ИдСв" mode="name"/></td>
                <td class="g">(2)</td>
              </tr>
              <tr>
                <th>Адрес</th>
                <td class="v"><xsl:apply-templates select="$seller/Адрес/*"/></td>
                <td class="g">(2а)</td>
              </tr>
              <tr>
                <th>ИНН/КПП продавца</th>
                <td class="v"><xsl:apply-templates select="$seller" mode="inn-kpp"/></td>
                <td class="g">(2б)</td>
              </tr>
              <tr>
                <th>Грузоотправитель и его адрес</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/ГрузОт/ОнЖе">он же</xsl:when>
                    <xsl:when test="$hdr/ГрузОт/ГрузОтпр">
                      <xsl:apply-templates select="$hdr/ГрузОт/ГрузОтпр[1]" mode="name-address"/>
                    </xsl:when>
                    <xsl:otherwise>—</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(3)</td>
              </tr>
              <tr>
                <th>Грузополучатель и его адрес</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/ГрузПолуч">
                      <xsl:apply-templates select="$hdr/ГрузПолуч[1]" mode="name-address"/>
                    </xsl:when>
                    <xsl:otherwise>—</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(4)</td>
              </tr>
              <tr>
                <th>К платежно-расчетному документу</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/СвПРД">
                      <xsl:for-each select="$hdr/СвПРД">
                        <xsl:if test="position() &gt; 1">; </xsl:if>
                        <xsl:text>№ </xsl:text>
                        <xsl:value-of select="@НомерПРД"/>
                        <xsl:text> от </xsl:text>
                        <xsl:value-of select="@ДатаПРД"/>
                      </xsl:for-each>
                    </xsl:when>
                    <xsl:otherwise>№ — от —</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(5)</td>
              </tr>
              <tr>
                <th>Документ об отгрузке</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/ДокПодтвОтгрНом">
                      <xsl:text>№ п/п 1–</xsl:text>
                      <xsl:value-of select="count($table/СведТов)"/>
                      <xsl:text> </xsl:text>
                      <xsl:for-each select="$hdr/ДокПодтвОтгрНом">
                        <xsl:if test="position() &gt; 1">; </xsl:if>
                        <xsl:apply-templates select="." mode="doc-ref"/>
                      </xsl:for-each>
                    </xsl:when>
                    <xsl:otherwise>—</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(5а)</td>
              </tr>
              <tr>
                <th>Покупатель</th>
                <td class="v"><xsl:apply-templates select="$buyer/ИдСв" mode="name"/></td>
                <td class="g">(6)</td>
              </tr>
              <tr>
                <th>Адрес</th>
                <td class="v"><xsl:apply-templates select="$buyer/Адрес/*"/></td>
                <td class="g">(6а)</td>
              </tr>
              <tr>
                <th>ИНН/КПП покупателя</th>
                <td class="v"><xsl:apply-templates select="$buyer" mode="inn-kpp"/></td>
                <td class="g">(6б)</td>
              </tr>
              <tr>
                <th>Валюта: наименование, код</th>
                <td class="v">
                  <xsl:value-of select="$hdr/ДенИзм/@НаимОКВ"/>
                  <xsl:text>, </xsl:text>
                  <xsl:value-of select="$hdr/ДенИзм/@КодОКВ"/>
                </td>
                <td class="g">(7)</td>
              </tr>
              <tr>
                <th>Идентификатор государственного контракта, договора (соглашения)</th>
                <td class="v">
                  <xsl:choose>
                    <xsl:when test="$hdr/ДопСвФХЖ1/@ИдГосКон"><xsl:value-of select="$hdr/ДопСвФХЖ1/@ИдГосКон"/></xsl:when>
                    <xsl:otherwise>—</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="g">(8)</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <xsl:call-template name="items"/>
      <xsl:call-template name="sign-top"/>
      <xsl:call-template name="bottom"/>

      <footer class="meta">
        <div>
          <xsl:text>Электронный документ: УПД, формат </xsl:text>
          <xsl:value-of select="$file/@ВерсФорм"/>
          <xsl:text>, функция </xsl:text>
          <xsl:value-of select="$fn"/>
          <xsl:text>. Сформирован </xsl:text>
          <xsl:value-of select="$doc/@ДатаИнфПр"/>
          <xsl:text> в </xsl:text>
          <xsl:value-of select="translate($doc/@ВремИнфПр, '.', ':')"/>
          <xsl:if test="$file/@ВерсПрог">
            <xsl:text>, программа: </xsl:text>
            <xsl:value-of select="$file/@ВерсПрог"/>
          </xsl:if>
          <xsl:text>.</xsl:text>
        </div>
        <div class="file-id">
          <xsl:text>Файл: </xsl:text>
          <xsl:value-of select="$file/@ИдФайл"/>
        </div>
      </footer>
    </article>
  </xsl:template>

  <!-- ================================================================ участники -->

  <xsl:template match="*" mode="inn-kpp">
    <xsl:variable name="id" select="ИдСв/*[1]"/>
    <xsl:value-of select="$id/@ИННЮЛ | $id/@ИННФЛ"/>
    <xsl:if test="$id/@КПП">
      <xsl:text>/</xsl:text>
      <xsl:value-of select="$id/@КПП"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="*" mode="name-address">
    <xsl:apply-templates select="ИдСв" mode="name"/>
    <xsl:if test="Адрес">
      <xsl:text>, </xsl:text>
      <xsl:apply-templates select="Адрес/*"/>
    </xsl:if>
  </xsl:template>

  <!-- ================================================================ таблица -->

  <xsl:template name="items">
    <table class="items">
      <thead>
        <tr>
          <th rowspan="2">№<br/>п/п</th>
          <th rowspan="2">Код товара/ работ, услуг</th>
          <th rowspan="2" class="name">Наименование товара (описание выполненных работ, оказанных услуг), имущественного права</th>
          <th rowspan="2">Код вида товара</th>
          <th colspan="2">Единица измерения</th>
          <th rowspan="2">Коли-<br/>чество (объем)</th>
          <th rowspan="2">Цена (тариф) за единицу измерения</th>
          <th rowspan="2">Стоимость товаров (работ, услуг), имущественных прав без налога — всего</th>
          <th rowspan="2">В том числе сумма акциза</th>
          <th rowspan="2">Нало-<br/>говая ставка</th>
          <th rowspan="2">Сумма налога, предъявляемая покупателю</th>
          <th rowspan="2">Стоимость товаров (работ, услуг), имущественных прав с налогом — всего</th>
          <th colspan="2">Страна происхождения товара</th>
          <th rowspan="2">Регистрационный номер декларации на товары или партии товара</th>
        </tr>
        <tr>
          <th>код</th>
          <th>условное обозна-<br/>чение (нацио-<br/>нальное)</th>
          <th>цифро-<br/>вой код</th>
          <th>краткое наимено-<br/>вание</th>
        </tr>
        <tr class="cols">
          <th>А</th><th>Б</th><th>1</th><th>1а</th><th>2</th><th>2а</th><th>3</th><th>4</th><th>5</th>
          <th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>10а</th><th>11</th>
        </tr>
      </thead>
      <tbody>
        <xsl:for-each select="$table/СведТов">
          <tr>
            <td class="c"><xsl:value-of select="@НомСтр"/></td>
            <td class="c"><xsl:value-of select="ДопСведТов/@КодТов"/></td>
            <td class="name">
              <xsl:value-of select="@НаимТов"/>
              <xsl:if test="ДопСведТов/@ХарактерТов">
                <div class="note"><xsl:value-of select="ДопСведТов/@ХарактерТов"/></div>
              </xsl:if>
            </td>
            <td class="c"><xsl:value-of select="ДопСведТов/@КодВидТов"/></td>
            <td class="c"><xsl:value-of select="@ОКЕИ_Тов"/></td>
            <td class="c"><xsl:value-of select="@НаимЕдИзм"/></td>
            <td class="r">
              <xsl:if test="@КолТов">
                <xsl:value-of select="format-number(@КолТов, '#&#160;##0,###', 'ru')"/>
              </xsl:if>
            </td>
            <td class="r">
              <xsl:if test="@ЦенаТов">
                <xsl:value-of select="format-number(@ЦенаТов, '#&#160;##0,00#########', 'ru')"/>
              </xsl:if>
            </td>
            <td class="r"><xsl:call-template name="money"><xsl:with-param name="v" select="@СтТовБезНДС"/></xsl:call-template></td>
            <td class="c">
              <xsl:choose>
                <xsl:when test="Акциз/СумАкциз"><xsl:call-template name="money"><xsl:with-param name="v" select="Акциз/СумАкциз"/></xsl:call-template></xsl:when>
                <xsl:otherwise>без акциза</xsl:otherwise>
              </xsl:choose>
            </td>
            <td class="c"><xsl:value-of select="@НалСт"/></td>
            <td class="r">
              <xsl:choose>
                <xsl:when test="СумНал/СумНал"><xsl:call-template name="money"><xsl:with-param name="v" select="СумНал/СумНал"/></xsl:call-template></xsl:when>
                <xsl:otherwise><xsl:value-of select="СумНал/*"/></xsl:otherwise>
              </xsl:choose>
            </td>
            <td class="r"><xsl:call-template name="money"><xsl:with-param name="v" select="@СтТовУчНал"/></xsl:call-template></td>
            <td class="c"><xsl:value-of select="СвДТ[1]/@КодПроисх"/></td>
            <td class="c"><xsl:value-of select="ДопСведТов/КрНаимСтрПр[1]"/></td>
            <td class="c"><xsl:value-of select="СвДТ[1]/@НомерДТ"/></td>
          </tr>
        </xsl:for-each>
        <tr class="total">
          <td colspan="8" class="label">Всего к оплате (9)</td>
          <td class="r"><xsl:call-template name="money"><xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовБезНДСВсего"/></xsl:call-template></td>
          <td colspan="2" class="c">X</td>
          <td class="r">
            <xsl:choose>
              <xsl:when test="$table/ВсегоОпл/СумНалВсего/СумНал"><xsl:call-template name="money"><xsl:with-param name="v" select="$table/ВсегоОпл/СумНалВсего/СумНал"/></xsl:call-template></xsl:when>
              <xsl:otherwise><xsl:value-of select="$table/ВсегоОпл/СумНалВсего/*"/></xsl:otherwise>
            </xsl:choose>
          </td>
          <td class="r"><xsl:call-template name="money"><xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовУчНалВсего"/></xsl:call-template></td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
    <xsl:if test="($hdr/ДенИзм/@КодОКВ = '643' or not($hdr/ДенИзм)) and $table/ВсегоОпл/@СтТовУчНалВсего">
      <p class="words">
        <xsl:text>Всего к оплате: </xsl:text>
        <xsl:call-template name="amount-in-words">
          <xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовУчНалВсего"/>
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$table/ВсегоОпл/СумНалВсего/СумНал">
            <xsl:text>, в т.ч. НДС </xsl:text>
            <xsl:call-template name="money"><xsl:with-param name="v" select="$table/ВсегоОпл/СумНалВсего/СумНал"/></xsl:call-template>
            <xsl:text> руб.</xsl:text>
          </xsl:when>
          <xsl:otherwise>, без НДС</xsl:otherwise>
        </xsl:choose>
      </p>
    </xsl:if>
  </xsl:template>

  <!-- ================================================================ подписи под таблицей -->

  <xsl:template name="sign-top">
    <xsl:variable name="isIp" select="$seller/ИдСв/СвИП"/>
    <table class="sign-top">
      <tr>
        <td class="lbl">Руководитель организации или иное уполномоченное лицо</td>
        <td class="sig"><span class="line"></span><span class="cap">(подпись)</span></td>
        <td class="fio">
          <span class="line-text">
            <xsl:if test="not($isIp)"><xsl:apply-templates select="$signer/ФИО" mode="short"/></xsl:if>
          </span>
          <span class="cap">(ф.и.о.)</span>
        </td>
        <td class="lbl">Главный бухгалтер или иное уполномоченное лицо</td>
        <td class="sig"><span class="line"></span><span class="cap">(подпись)</span></td>
        <td class="fio"><span class="line-text"></span><span class="cap">(ф.и.о.)</span></td>
      </tr>
      <tr>
        <td class="lbl">Индивидуальный предприниматель или иное уполномоченное лицо</td>
        <td class="sig"><span class="line"></span><span class="cap">(подпись)</span></td>
        <td class="fio">
          <span class="line-text">
            <xsl:if test="$isIp"><xsl:apply-templates select="$signer/ФИО" mode="short"/></xsl:if>
          </span>
          <span class="cap">(ф.и.о.)</span>
        </td>
        <td colspan="3" class="ogrn">
          <span class="line-text">
            <xsl:if test="$isIp">
              <xsl:text>ОГРНИП </xsl:text>
              <xsl:value-of select="$seller/ИдСв/СвИП/@ОГРНИП"/>
              <xsl:if test="$seller/ИдСв/СвИП/@ДатаОГРНИП">
                <xsl:text> от </xsl:text>
                <xsl:value-of select="$seller/ИдСв/СвИП/@ДатаОГРНИП"/>
              </xsl:if>
            </xsl:if>
          </span>
          <span class="cap">(реквизиты свидетельства о государственной регистрации индивидуального предпринимателя)</span>
        </td>
      </tr>
    </table>
  </xsl:template>

  <!-- ================================================================ нижняя часть -->

  <xsl:template name="bottom">
    <table class="bottom">
      <tr>
        <td colspan="2">
          <div class="row">
            <span class="k">Основание передачи (сдачи) / получения (приемки)</span>
            <span class="val">
              <xsl:choose>
                <xsl:when test="$per/ОснПер">
                  <xsl:for-each select="$per/ОснПер">
                    <xsl:if test="position() &gt; 1">; </xsl:if>
                    <xsl:apply-templates select="." mode="doc-ref"/>
                  </xsl:for-each>
                </xsl:when>
                <xsl:when test="$per/БезДокОснПер">Без документа-основания</xsl:when>
              </xsl:choose>
            </span>
            <span class="g">[8]</span>
          </div>
          <div class="row">
            <span class="k">Данные о транспортировке и грузе</span>
            <span class="val">
              <xsl:value-of select="$per/ТранГруз/@СвТранГруз"/>
              <xsl:for-each select="$per/ТранГруз/ТранНакл">
                <xsl:text> </xsl:text>
                <xsl:value-of select="@НомТранНакл"/>
                <xsl:text> от </xsl:text>
                <xsl:value-of select="@ДатаТранНакл"/>
              </xsl:for-each>
            </span>
            <span class="g">[9]</span>
          </div>
        </td>
      </tr>
      <tr>
        <td class="half seller-side">
          <div class="side-title">Товар (груз) передал / услуги, результаты работ, права сдал</div>
          <div class="signline">
            <span class="cell"><xsl:value-of select="$signer/@Должн"/><span class="cap">(должность)</span></span>
            <span class="cell sig"><span class="cap">(подпись)</span></span>
            <span class="cell"><xsl:apply-templates select="$signer/ФИО" mode="full"/><span class="cap">(ф.и.о.)</span></span>
            <span class="g">[10]</span>
          </div>
          <div class="row">
            <span class="k">Дата отгрузки, передачи (сдачи)</span>
            <span class="val">
              <xsl:choose>
                <xsl:when test="$per/@ДатаПер">
                  <xsl:call-template name="date-long"><xsl:with-param name="d" select="$per/@ДатаПер"/></xsl:call-template>
                </xsl:when>
                <xsl:when test="$per/@ДатаНачПер">
                  <xsl:text>период с </xsl:text>
                  <xsl:value-of select="$per/@ДатаНачПер"/>
                  <xsl:text> по </xsl:text>
                  <xsl:value-of select="$per/@ДатаОконПер"/>
                </xsl:when>
              </xsl:choose>
            </span>
            <span class="g">[11]</span>
          </div>
          <div class="row">
            <span class="k">Иные сведения об отгрузке, передаче</span>
            <span class="val"><xsl:value-of select="$per/@СодОпер"/></span>
            <span class="g">[12]</span>
          </div>
          <div class="side-title">Ответственный за правильность оформления факта хозяйственной жизни</div>
          <div class="signline">
            <span class="cell">
              <xsl:value-of select="$per/СвЛицПер/РабОргПрод/@Должность | $signer/@Должн[not($per/СвЛицПер)]"/>
              <span class="cap">(должность)</span>
            </span>
            <span class="cell sig"><span class="cap">(подпись)</span></span>
            <span class="cell">
              <xsl:choose>
                <xsl:when test="$per/СвЛицПер/РабОргПрод/ФИО"><xsl:apply-templates select="$per/СвЛицПер/РабОргПрод/ФИО" mode="full"/></xsl:when>
                <xsl:otherwise><xsl:apply-templates select="$signer/ФИО" mode="full"/></xsl:otherwise>
              </xsl:choose>
              <span class="cap">(ф.и.о.)</span>
            </span>
            <span class="g">[13]</span>
          </div>
          <div class="side-title">Наименование экономического субъекта — составителя документа (в т.ч. комиссионера / агента)</div>
          <div class="row">
            <span class="val">
              <xsl:choose>
                <xsl:when test="$doc/@НаимЭконСубСост"><xsl:value-of select="$doc/@НаимЭконСубСост"/></xsl:when>
                <xsl:otherwise>
                  <xsl:apply-templates select="$seller/ИдСв" mode="name"/>
                  <xsl:text>, ИНН/КПП </xsl:text>
                  <xsl:apply-templates select="$seller" mode="inn-kpp"/>
                </xsl:otherwise>
              </xsl:choose>
            </span>
            <span class="g">[14]</span>
          </div>
          <div class="mp">М.П.</div>
        </td>
        <td class="half buyer-side">
          <div class="side-title">Товар (груз) получил / услуги, результаты работ, права принял</div>
          <div class="signline">
            <span class="cell"><span class="cap">(должность)</span></span>
            <span class="cell sig"><span class="cap">(подпись)</span></span>
            <span class="cell"><span class="cap">(ф.и.о.)</span></span>
            <span class="g">[15]</span>
          </div>
          <div class="row"><span class="k">Дата получения (приемки)</span><span class="val"></span><span class="g">[16]</span></div>
          <div class="row"><span class="k">Иные сведения о получении, приемке</span><span class="val"></span><span class="g">[17]</span></div>
          <div class="side-title">Ответственный за правильность оформления факта хозяйственной жизни</div>
          <div class="signline">
            <span class="cell"><span class="cap">(должность)</span></span>
            <span class="cell sig"><span class="cap">(подпись)</span></span>
            <span class="cell"><span class="cap">(ф.и.о.)</span></span>
            <span class="g">[18]</span>
          </div>
          <div class="side-title">Наименование экономического субъекта — составителя документа</div>
          <div class="row">
            <span class="val">
              <xsl:apply-templates select="$buyer/ИдСв" mode="name"/>
              <xsl:text>, ИНН/КПП </xsl:text>
              <xsl:apply-templates select="$buyer" mode="inn-kpp"/>
            </span>
            <span class="g">[19]</span>
          </div>
          <div class="mp">М.П.</div>
        </td>
      </tr>
    </table>
  </xsl:template>

  <!-- ================================================================ стили -->

  <xsl:template name="css">
    <xsl:text>
@page { size: A4 landscape; margin: 8mm 8mm 8mm 10mm; }
* { box-sizing: border-box; }
html { background: #e9e9ec; }
body { margin: 0; padding: 24px 0; font: 7.5pt/1.25 Arial, "Helvetica Neue", sans-serif; color: #000; }
.page { width: 297mm; min-height: 210mm; margin: 0 auto; padding: 8mm 8mm 8mm 10mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.25); }
table { border-collapse: collapse; }
.head { width: 100%; }
.head > tbody > tr > td { vertical-align: top; }
.status-box { width: 30mm; padding: 0 3mm 0 0; border-right: 2px solid #000; }
.doc-title { font-size: 9pt; font-weight: bold; line-height: 1.15; margin-bottom: 4mm; }
.status { display: flex; align-items: center; gap: 4px; margin-bottom: 2mm; }
.status-val { display: inline-block; min-width: 9mm; border: 1px solid #000; text-align: center; font-size: 10pt; padding: 1px 4px; }
.status-hint { font-size: 6.5pt; color: #222; }
.head-main { padding-left: 3mm; }
.fields { width: 100%; }
.fields th { text-align: left; font-weight: normal; padding: 1px 6px 1px 0; width: 52mm; vertical-align: bottom; }
.fields td.v { border-bottom: 1px solid #000; padding: 1px 4px; vertical-align: bottom; }
.fields td.g { width: 1%; white-space: nowrap; padding-left: 6px; vertical-align: bottom; }
.fields tr.big th, .fields tr.big td { font-size: 9pt; }
.doc-kind { margin: 2px 0 2mm; font-size: 7pt; color: #333; }
table.items { width: 100%; margin-top: 3mm; border: 1.5px solid #000; }
.items th, .items td { border: 1px solid #000; padding: 1px 3px; vertical-align: top; }
.items th { font-weight: normal; font-size: 6.5pt; text-align: center; vertical-align: middle; line-height: 1.1; }
.items tr.cols th { font-size: 6.5pt; padding: 0 2px; }
.items th.name { width: 24%; }
.items td.name { text-align: left; }
.items .c { text-align: center; }
.items .r { text-align: right; white-space: nowrap; }
.items .note { color: #444; font-size: 6.5pt; }
.items tr.total td { font-weight: bold; }
.items tr.total .label { text-align: left; }
.words { margin: 2mm 0 0; font-weight: bold; }
.sign-top { width: 100%; margin-top: 3mm; border-top: 2px solid #000; border-bottom: 2px solid #000; }
.sign-top td { padding: 4px 4px 2px; vertical-align: bottom; }
.sign-top .lbl { width: 17%; font-size: 7pt; }
.sign-top .sig { width: 10%; }
.sign-top .fio { width: 15%; }
.line, .line-text { display: block; border-bottom: 1px solid #000; min-height: 12px; text-align: center; }
.cap { display: block; text-align: center; font-size: 5.5pt; color: #333; }
.bottom { width: 100%; margin-top: 2mm; table-layout: fixed; }
.bottom td { vertical-align: top; padding: 2px 0; }
.bottom .half { width: 50%; padding-top: 2mm; }
.bottom .seller-side { padding-right: 4mm; border-right: 2px solid #000; }
.bottom .buyer-side { padding-left: 4mm; }
.row { display: flex; align-items: flex-end; gap: 6px; margin: 2px 0; }
.row .k { white-space: nowrap; }
.row .val { flex: 1; border-bottom: 1px solid #000; min-height: 12px; padding: 0 2px; }
.g { white-space: nowrap; font-size: 6.5pt; }
.side-title { margin-top: 3px; }
.signline { display: flex; align-items: flex-end; gap: 6px; margin: 2px 0 3px; }
.signline .cell { flex: 1; border-bottom: 1px solid #000; min-height: 12px; position: relative; padding-bottom: 0; text-align: center; margin-bottom: 9px; }
.signline .cell .cap { position: absolute; left: 0; right: 0; top: 100%; }
.signline .sig { flex: .6; }
.mp { margin-top: 4px; font-size: 7pt; }
.meta { margin-top: 4mm; padding-top: 4px; border-top: 1px dashed #999; color: #555; font-size: 6.5pt; }
.meta .file-id { word-break: break-all; }
.error { width: 297mm; margin: 0 auto 12px; padding: 8px 12px; background: #fde7e9; border: 1px solid #d13438; }

@media print {
  html, body { background: #fff; padding: 0; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  tr { break-inside: avoid; }
}
</xsl:text>
  </xsl:template>

</xsl:stylesheet>

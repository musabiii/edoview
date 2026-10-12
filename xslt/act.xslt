<?xml version="1.0" encoding="UTF-8"?>
<!--
  Печатная форма «Акт выполненных работ (оказанных услуг)»
  для XML УПД формата 5.03 (приказ ФНС ЕД-7-26/970@), титул продавца, функция ДОП.

  XSLT 1.0: работает в libxslt (lxml, xslt-polyfill, нативный XSLTProcessor).
  Общие шаблоны — в common.xslt (xsl:include; для браузера его встраивает app/lib/render.js).
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:include href="common.xslt"/>

  <xsl:output method="html" encoding="UTF-8" indent="no"/>


  <!-- Атрибуты корня читаем только через $file: libxml2 не парсит «/Файл/@Атр»
       (абсолютный путь с кириллическим именем + шаг-атрибут), а «$file/@Атр» работает. -->
  <xsl:variable name="file" select="/Файл"/>
  <xsl:variable name="doc" select="$file/Документ"/>
  <xsl:variable name="hdr" select="$doc/СвСчФакт"/>
  <xsl:variable name="table" select="$doc/ТаблСчФакт"/>
  <xsl:variable name="per" select="$doc/СвПродПер/СвПер"/>
  <xsl:variable name="isRub" select="not($hdr/ДенИзм/@КодОКВ) or $hdr/ДенИзм/@КодОКВ = '643'"/>

  <!-- ================================================================ страница -->

  <xsl:template match="/">
    <html lang="ru">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>
          <xsl:text>Акт № </xsl:text>
          <xsl:value-of select="$hdr/@НомерДок"/>
          <xsl:text> от </xsl:text>
          <xsl:value-of select="$hdr/@ДатаДок"/>
        </title>
        <style><xsl:call-template name="css"/></style>
      </head>
      <body>
        <xsl:choose>
          <xsl:when test="not($doc)">
            <p class="error">Это не файл УПД: нет элемента Файл/Документ.</p>
          </xsl:when>
          <xsl:otherwise>
            <xsl:if test="$doc/@Функция != 'ДОП'">
              <p class="warn">
                <xsl:text>Внимание: функция документа «</xsl:text>
                <xsl:value-of select="$doc/@Функция"/>
                <xsl:text>», шаблон рассчитан на «ДОП» (без счёта-фактуры).</xsl:text>
              </p>
            </xsl:if>
            <xsl:call-template name="act"/>
          </xsl:otherwise>
        </xsl:choose>
      </body>
    </html>
  </xsl:template>

  <xsl:template name="act">
    <article class="page">
      <h1>
        <xsl:text>Акт № </xsl:text>
        <xsl:value-of select="$hdr/@НомерДок"/>
        <xsl:text> от </xsl:text>
        <xsl:call-template name="date-long">
          <xsl:with-param name="d" select="$hdr/@ДатаДок"/>
        </xsl:call-template>
      </h1>
      <xsl:if test="$doc/@НаимДокОпр">
        <p class="subtitle"><xsl:value-of select="$doc/@НаимДокОпр"/></p>
      </xsl:if>
      <xsl:if test="$hdr/ИспрДок">
        <p class="subtitle">
          <xsl:text>Исправление № </xsl:text>
          <xsl:value-of select="$hdr/ИспрДок/@НомИспр"/>
          <xsl:text> от </xsl:text>
          <xsl:value-of select="$hdr/ИспрДок/@ДатаИспр"/>
        </p>
      </xsl:if>

      <table class="parties">
        <tr>
          <th>Исполнитель:</th>
          <td><xsl:apply-templates select="$hdr/СвПрод[1]" mode="requisites"/></td>
        </tr>
        <tr>
          <th>Заказчик:</th>
          <td><xsl:apply-templates select="$hdr/СвПокуп[1]" mode="requisites"/></td>
        </tr>
        <xsl:if test="$per/ОснПер">
          <tr>
            <th>Основание:</th>
            <td>
              <xsl:for-each select="$per/ОснПер">
                <xsl:if test="position() &gt; 1">; </xsl:if>
                <xsl:apply-templates select="." mode="doc-ref"/>
              </xsl:for-each>
            </td>
          </tr>
        </xsl:if>
        <xsl:choose>
          <xsl:when test="$per/@ДатаНачПер">
            <tr>
              <th>Период:</th>
              <td>
                <xsl:text>с </xsl:text>
                <xsl:value-of select="$per/@ДатаНачПер"/>
                <xsl:text> по </xsl:text>
                <xsl:value-of select="$per/@ДатаОконПер"/>
              </td>
            </tr>
          </xsl:when>
          <xsl:when test="$per/@ДатаПер">
            <tr>
              <th>Дата оказания:</th>
              <td><xsl:value-of select="$per/@ДатаПер"/></td>
            </tr>
          </xsl:when>
        </xsl:choose>
      </table>

      <xsl:call-template name="items"/>

      <p class="summary">
        <xsl:text>Всего оказано услуг </xsl:text>
        <xsl:value-of select="count($table/СведТов)"/>
        <xsl:text>, на сумму </xsl:text>
        <xsl:call-template name="money">
          <xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовУчНалВсего"/>
        </xsl:call-template>
        <xsl:text> </xsl:text>
        <xsl:call-template name="currency-short"/>
      </p>
      <xsl:if test="$isRub and $table/ВсегоОпл/@СтТовУчНалВсего">
        <p class="words">
          <xsl:call-template name="amount-in-words">
            <xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовУчНалВсего"/>
          </xsl:call-template>
        </p>
      </xsl:if>

      <p class="statement">
        <xsl:choose>
          <xsl:when test="$per/@СодОпер">
            <xsl:value-of select="$per/@СодОпер"/>
            <xsl:text>. </xsl:text>
          </xsl:when>
          <xsl:otherwise>Вышеперечисленные услуги выполнены полностью и в срок. </xsl:otherwise>
        </xsl:choose>
        <xsl:text>Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.</xsl:text>
      </p>

      <xsl:call-template name="signatures"/>

      <footer class="meta">
        <div>
          <xsl:text>Электронный документ: УПД, формат </xsl:text>
          <xsl:value-of select="$file/@ВерсФорм"/>
          <xsl:text>, функция </xsl:text>
          <xsl:value-of select="$doc/@Функция"/>
          <xsl:text>. Сформирован </xsl:text>
          <xsl:value-of select="$doc/@ДатаИнфПр"/>
          <xsl:text> в </xsl:text>
          <xsl:value-of select="translate($doc/@ВремИнфПр, '.', ':')"/>
          <xsl:if test="$doc/@НаимЭконСубСост">
            <xsl:text>, составитель: </xsl:text>
            <xsl:value-of select="$doc/@НаимЭконСубСост"/>
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

  <!-- ================================================================ таблица услуг -->

  <xsl:template name="items">
    <xsl:variable name="hasVat" select="$table/СведТов/СумНал/СумНал"/>
    <table class="items">
      <thead>
        <tr>
          <th class="num">№</th>
          <th>Наименование работ, услуг</th>
          <th class="qty">Кол-во</th>
          <th class="unit">Ед.</th>
          <th class="money">Цена</th>
          <th class="money">Сумма</th>
        </tr>
      </thead>
      <tbody>
        <xsl:for-each select="$table/СведТов">
          <tr>
            <td class="num"><xsl:value-of select="@НомСтр"/></td>
            <td>
              <xsl:value-of select="@НаимТов"/>
              <xsl:if test="ДопСведТов/@ХарактерТов">
                <xsl:if test="@НаимТов"><br/></xsl:if>
                <span class="note"><xsl:value-of select="ДопСведТов/@ХарактерТов"/></span>
              </xsl:if>
            </td>
            <td class="qty">
              <xsl:if test="@КолТов">
                <xsl:value-of select="format-number(@КолТов, '#&#160;##0,###', 'ru')"/>
              </xsl:if>
            </td>
            <td class="unit"><xsl:value-of select="@НаимЕдИзм"/></td>
            <td class="money">
              <xsl:call-template name="money">
                <xsl:with-param name="v" select="@ЦенаТов"/>
              </xsl:call-template>
            </td>
            <td class="money">
              <xsl:call-template name="money">
                <xsl:with-param name="v" select="@СтТовБезНДС | @СтТовУчНал[not(../@СтТовБезНДС)]"/>
              </xsl:call-template>
            </td>
          </tr>
        </xsl:for-each>
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <th>Итого:</th>
        <td>
          <xsl:call-template name="money">
            <xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовБезНДСВсего"/>
          </xsl:call-template>
        </td>
      </tr>
      <tr>
        <xsl:choose>
          <xsl:when test="$hasVat">
            <th>В том числе НДС:</th>
            <td>
              <xsl:call-template name="money">
                <xsl:with-param name="v" select="$table/ВсегоОпл/СумНалВсего/СумНал"/>
              </xsl:call-template>
            </td>
          </xsl:when>
          <xsl:otherwise>
            <th>Без налога (НДС):</th>
            <td>—</td>
          </xsl:otherwise>
        </xsl:choose>
      </tr>
      <tr class="grand">
        <th>Всего:</th>
        <td>
          <xsl:call-template name="money">
            <xsl:with-param name="v" select="$table/ВсегоОпл/@СтТовУчНалВсего"/>
          </xsl:call-template>
        </td>
      </tr>
    </table>
  </xsl:template>

  <!-- ================================================================ подписи -->

  <xsl:template name="signatures">
    <xsl:variable name="signer" select="$doc/Подписант[1]"/>
    <table class="signatures">
      <tr>
        <td>
          <div class="role">Исполнитель</div>
          <div class="post"><xsl:value-of select="$signer/@Должн"/></div>
          <div class="line">
            <span class="blank"></span>
            <span class="who">
              <xsl:apply-templates select="$signer/ФИО" mode="short"/>
            </span>
          </div>
        </td>
        <td>
          <div class="role">Заказчик</div>
          <div class="post"><xsl:apply-templates select="$hdr/СвПокуп[1]/ИдСв" mode="name"/></div>
          <div class="line">
            <span class="blank"></span>
            <span class="who"></span>
          </div>
        </td>
      </tr>
    </table>
  </xsl:template>

  <xsl:template name="currency-short">
    <xsl:choose>
      <xsl:when test="$isRub">руб.</xsl:when>
      <xsl:otherwise><xsl:value-of select="$hdr/ДенИзм/@НаимОКВ"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- 06.10.2026 → «6 октября 2026 г.» -->

  <!-- ================================================================ стили -->

  <xsl:template name="css">
    <xsl:call-template name="css-base"/>
  </xsl:template>

</xsl:stylesheet>

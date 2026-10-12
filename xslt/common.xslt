<?xml version="1.0" encoding="UTF-8"?>
<!--
  Общие шаблоны печатных форм (акт, счёт): реквизиты сторон в структуре УПД 5.03,
  адреса, деньги, даты, сумма прописью, базовые стили.

  Подключается через xsl:include. Браузерный полифил не умеет подгружать include
  синхронно, поэтому app/lib/render.js встраивает этот файл в шаблон сам.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:decimal-format name="ru" decimal-separator="," grouping-separator="&#160;"/>

  <!-- ================================================================ участники -->

  <!-- Реквизиты стороны одной строкой: «ИП Петров…, ИНН …, адрес, р/с … в банке, тел.» -->
  <xsl:template match="*" mode="requisites">
    <strong><xsl:apply-templates select="ИдСв" mode="name"/></strong>
    <xsl:apply-templates select="ИдСв/*" mode="ids"/>
    <xsl:if test="Адрес">
      <xsl:text>, </xsl:text>
      <xsl:apply-templates select="Адрес/*"/>
    </xsl:if>
    <xsl:apply-templates select="БанкРекв"/>
    <xsl:if test="Контакт/Тлф">
      <xsl:text>, тел. </xsl:text>
      <xsl:value-of select="Контакт/Тлф[1]"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="ИдСв" mode="name">
    <xsl:choose>
      <xsl:when test="СвИП">
        <xsl:text>ИП </xsl:text>
        <xsl:apply-templates select="СвИП/ФИО" mode="full"/>
      </xsl:when>
      <xsl:when test="СвЮЛУч"><xsl:value-of select="СвЮЛУч/@НаимОрг"/></xsl:when>
      <xsl:when test="СвФЛУч"><xsl:apply-templates select="СвФЛУч/ФИО" mode="full"/></xsl:when>
      <xsl:when test="СвИнНеУч"><xsl:value-of select="СвИнНеУч/@Наим"/></xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="СвИП" mode="ids">
    <xsl:text>, ИНН </xsl:text><xsl:value-of select="@ИННФЛ"/>
    <xsl:if test="@ОГРНИП">
      <xsl:text>, ОГРНИП </xsl:text><xsl:value-of select="@ОГРНИП"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="СвЮЛУч" mode="ids">
    <xsl:text>, ИНН </xsl:text><xsl:value-of select="@ИННЮЛ"/>
    <xsl:if test="@КПП">
      <xsl:text>, КПП </xsl:text><xsl:value-of select="@КПП"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="СвФЛУч" mode="ids">
    <xsl:if test="@ИННФЛ">
      <xsl:text>, ИНН </xsl:text><xsl:value-of select="@ИННФЛ"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="СвИнНеУч" mode="ids">
    <xsl:text>, </xsl:text><xsl:value-of select="@НаимСтран"/>
    <xsl:if test="@Идентиф">
      <xsl:text>, </xsl:text><xsl:value-of select="@Идентиф"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="ФИО" mode="full">
    <xsl:value-of select="normalize-space(concat(@Фамилия, ' ', @Имя, ' ', @Отчество))"/>
  </xsl:template>

  <!-- «Петров С. И.» -->
  <xsl:template match="ФИО" mode="short">
    <xsl:value-of select="@Фамилия"/>
    <xsl:text> </xsl:text>
    <xsl:value-of select="substring(@Имя, 1, 1)"/>
    <xsl:text>.</xsl:text>
    <xsl:if test="@Отчество">
      <xsl:text> </xsl:text>
      <xsl:value-of select="substring(@Отчество, 1, 1)"/>
      <xsl:text>.</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="БанкРекв">
    <xsl:if test="@НомерСчета">
      <xsl:text>, р/с </xsl:text><xsl:value-of select="@НомерСчета"/>
    </xsl:if>
    <xsl:if test="СвБанк/@НаимБанк">
      <xsl:text> в </xsl:text><xsl:value-of select="СвБанк/@НаимБанк"/>
    </xsl:if>
    <xsl:if test="СвБанк/@БИК">
      <xsl:text>, БИК </xsl:text><xsl:value-of select="СвБанк/@БИК"/>
    </xsl:if>
    <xsl:if test="СвБанк/@КорСчет">
      <xsl:text>, к/с </xsl:text><xsl:value-of select="СвБанк/@КорСчет"/>
    </xsl:if>
  </xsl:template>

  <!-- ================================================================ адреса -->

  <xsl:template match="АдрИнф">
    <xsl:value-of select="@АдрТекст"/>
    <xsl:if test="@КодСтр != '643'">
      <xsl:text>, </xsl:text><xsl:value-of select="@НаимСтран"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="АдрРФ">
    <xsl:call-template name="join">
      <xsl:with-param name="parts" select="@Индекс | @НаимРегион | @Район | @Город | @НаселПункт | @Улица"/>
    </xsl:call-template>
    <xsl:if test="@Дом">, д. <xsl:value-of select="@Дом"/></xsl:if>
    <xsl:if test="@Корпус">, корп. <xsl:value-of select="@Корпус"/></xsl:if>
    <xsl:if test="@Кварт">, кв. <xsl:value-of select="@Кварт"/></xsl:if>
    <xsl:if test="@ИныеСвед">, <xsl:value-of select="@ИныеСвед"/></xsl:if>
  </xsl:template>

  <xsl:template match="АдрГАР">
    <xsl:if test="@Индекс"><xsl:value-of select="@Индекс"/>, </xsl:if>
    <xsl:value-of select="НаимРегион"/>
    <xsl:for-each select="МуниципРайон | ГородСелПоселен">
      <xsl:text>, </xsl:text><xsl:value-of select="@Наим"/>
    </xsl:for-each>
    <xsl:for-each select="НаселенПункт">
      <xsl:text>, </xsl:text><xsl:value-of select="concat(@Вид, ' ', @Наим)"/>
    </xsl:for-each>
    <xsl:for-each select="ЭлПланСтруктур | ЭлУлДорСети">
      <xsl:text>, </xsl:text><xsl:value-of select="concat(@Тип, ' ', @Наим)"/>
    </xsl:for-each>
    <xsl:for-each select="ЗемелУчасток">
      <xsl:text>, уч. </xsl:text><xsl:value-of select="."/>
    </xsl:for-each>
    <xsl:for-each select="Здание | ПомещЗдания | ПомещКвартиры">
      <xsl:text>, </xsl:text><xsl:value-of select="concat(@Тип, ' ', @Номер)"/>
    </xsl:for-each>
  </xsl:template>

  <xsl:template name="join">
    <xsl:param name="parts"/>
    <xsl:for-each select="$parts">
      <xsl:if test="position() &gt; 1">, </xsl:if>
      <xsl:value-of select="."/>
    </xsl:for-each>
  </xsl:template>

  <!-- «Договор № 12/26 от 15.01.2026» -->
  <xsl:template match="*" mode="doc-ref">
    <xsl:value-of select="@РеквНаимДок"/>
    <xsl:if test="@РеквНомерДок != '' and @РеквНомерДок != 'Без номера'">
      <xsl:text> № </xsl:text><xsl:value-of select="@РеквНомерДок"/>
    </xsl:if>
    <xsl:text> от </xsl:text>
    <xsl:value-of select="@РеквДатаДок"/>
  </xsl:template>

  <!-- ================================================================ числа и даты -->

  <xsl:template name="money">
    <xsl:param name="v"/>
    <xsl:if test="string($v) != ''">
      <xsl:value-of select="format-number($v, '#&#160;##0,00', 'ru')"/>
    </xsl:if>
  </xsl:template>

  <xsl:template name="date-long">
    <xsl:param name="d"/>
    <xsl:variable name="m" select="number(substring($d, 4, 2))"/>
    <xsl:value-of select="number(substring($d, 1, 2))"/>
    <xsl:text> </xsl:text>
    <xsl:choose>
      <xsl:when test="$m = 1">января</xsl:when>
      <xsl:when test="$m = 2">февраля</xsl:when>
      <xsl:when test="$m = 3">марта</xsl:when>
      <xsl:when test="$m = 4">апреля</xsl:when>
      <xsl:when test="$m = 5">мая</xsl:when>
      <xsl:when test="$m = 6">июня</xsl:when>
      <xsl:when test="$m = 7">июля</xsl:when>
      <xsl:when test="$m = 8">августа</xsl:when>
      <xsl:when test="$m = 9">сентября</xsl:when>
      <xsl:when test="$m = 10">октября</xsl:when>
      <xsl:when test="$m = 11">ноября</xsl:when>
      <xsl:when test="$m = 12">декабря</xsl:when>
    </xsl:choose>
    <xsl:text> </xsl:text>
    <xsl:value-of select="substring($d, 7, 4)"/>
    <xsl:text> г.</xsl:text>
  </xsl:template>

  <!-- ================================================================ сумма прописью -->

  <!-- «22100.00» → «Двадцать две тысячи сто рублей 00 копеек».
       Целую часть и копейки режем из строки, чтобы не ловить ошибки округления double. -->
  <xsl:template name="amount-in-words">
    <xsl:param name="v"/>
    <xsl:variable name="s" select="normalize-space($v)"/>
    <xsl:variable name="intStr">
      <xsl:choose>
        <xsl:when test="contains($s, '.')"><xsl:value-of select="substring-before($s, '.')"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$s"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="kop" select="substring(concat(substring-after($s, '.'), '00'), 1, 2)"/>
    <xsl:variable name="n" select="number($intStr)"/>
    <xsl:variable name="words">
      <xsl:choose>
        <xsl:when test="$n = 0">ноль </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="group">
            <xsl:with-param name="t" select="floor($n div 1000000000) mod 1000"/>
            <xsl:with-param name="female" select="false()"/>
            <xsl:with-param name="one">миллиард</xsl:with-param>
            <xsl:with-param name="few">миллиарда</xsl:with-param>
            <xsl:with-param name="many">миллиардов</xsl:with-param>
          </xsl:call-template>
          <xsl:call-template name="group">
            <xsl:with-param name="t" select="floor($n div 1000000) mod 1000"/>
            <xsl:with-param name="female" select="false()"/>
            <xsl:with-param name="one">миллион</xsl:with-param>
            <xsl:with-param name="few">миллиона</xsl:with-param>
            <xsl:with-param name="many">миллионов</xsl:with-param>
          </xsl:call-template>
          <xsl:call-template name="group">
            <xsl:with-param name="t" select="floor($n div 1000) mod 1000"/>
            <xsl:with-param name="female" select="true()"/>
            <xsl:with-param name="one">тысяча</xsl:with-param>
            <xsl:with-param name="few">тысячи</xsl:with-param>
            <xsl:with-param name="many">тысяч</xsl:with-param>
          </xsl:call-template>
          <xsl:call-template name="group">
            <xsl:with-param name="t" select="$n mod 1000"/>
            <xsl:with-param name="female" select="false()"/>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:call-template name="plural">
        <xsl:with-param name="n" select="$n"/>
        <xsl:with-param name="one">рубль</xsl:with-param>
        <xsl:with-param name="few">рубля</xsl:with-param>
        <xsl:with-param name="many">рублей</xsl:with-param>
      </xsl:call-template>
      <xsl:text> </xsl:text>
      <xsl:value-of select="$kop"/>
      <xsl:text> </xsl:text>
      <xsl:call-template name="plural">
        <xsl:with-param name="n" select="number($kop)"/>
        <xsl:with-param name="one">копейка</xsl:with-param>
        <xsl:with-param name="few">копейки</xsl:with-param>
        <xsl:with-param name="many">копеек</xsl:with-param>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="w" select="normalize-space($words)"/>
    <xsl:value-of select="translate(substring($w, 1, 1), 'абвгдежзийклмнопрстуфхцчшщэюя', 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ')"/>
    <xsl:value-of select="substring($w, 2)"/>
  </xsl:template>

  <!-- Триада (0..999) словами + название разряда. -->
  <xsl:template name="group">
    <xsl:param name="t"/>
    <xsl:param name="female"/>
    <xsl:param name="one"/>
    <xsl:param name="few"/>
    <xsl:param name="many"/>
    <xsl:if test="$t &gt; 0">
      <xsl:variable name="h" select="floor($t div 100)"/>
      <xsl:variable name="r" select="$t mod 100"/>
      <xsl:variable name="d" select="floor($r div 10)"/>
      <xsl:variable name="u" select="$r mod 10"/>
      <xsl:choose>
        <xsl:when test="$h = 1">сто </xsl:when>
        <xsl:when test="$h = 2">двести </xsl:when>
        <xsl:when test="$h = 3">триста </xsl:when>
        <xsl:when test="$h = 4">четыреста </xsl:when>
        <xsl:when test="$h = 5">пятьсот </xsl:when>
        <xsl:when test="$h = 6">шестьсот </xsl:when>
        <xsl:when test="$h = 7">семьсот </xsl:when>
        <xsl:when test="$h = 8">восемьсот </xsl:when>
        <xsl:when test="$h = 9">девятьсот </xsl:when>
      </xsl:choose>
      <xsl:choose>
        <xsl:when test="$d = 1">
          <xsl:choose>
            <xsl:when test="$u = 0">десять </xsl:when>
            <xsl:when test="$u = 1">одиннадцать </xsl:when>
            <xsl:when test="$u = 2">двенадцать </xsl:when>
            <xsl:when test="$u = 3">тринадцать </xsl:when>
            <xsl:when test="$u = 4">четырнадцать </xsl:when>
            <xsl:when test="$u = 5">пятнадцать </xsl:when>
            <xsl:when test="$u = 6">шестнадцать </xsl:when>
            <xsl:when test="$u = 7">семнадцать </xsl:when>
            <xsl:when test="$u = 8">восемнадцать </xsl:when>
            <xsl:when test="$u = 9">девятнадцать </xsl:when>
          </xsl:choose>
        </xsl:when>
        <xsl:otherwise>
          <xsl:choose>
            <xsl:when test="$d = 2">двадцать </xsl:when>
            <xsl:when test="$d = 3">тридцать </xsl:when>
            <xsl:when test="$d = 4">сорок </xsl:when>
            <xsl:when test="$d = 5">пятьдесят </xsl:when>
            <xsl:when test="$d = 6">шестьдесят </xsl:when>
            <xsl:when test="$d = 7">семьдесят </xsl:when>
            <xsl:when test="$d = 8">восемьдесят </xsl:when>
            <xsl:when test="$d = 9">девяносто </xsl:when>
          </xsl:choose>
          <xsl:choose>
            <xsl:when test="$u = 1 and $female">одна </xsl:when>
            <xsl:when test="$u = 1">один </xsl:when>
            <xsl:when test="$u = 2 and $female">две </xsl:when>
            <xsl:when test="$u = 2">два </xsl:when>
            <xsl:when test="$u = 3">три </xsl:when>
            <xsl:when test="$u = 4">четыре </xsl:when>
            <xsl:when test="$u = 5">пять </xsl:when>
            <xsl:when test="$u = 6">шесть </xsl:when>
            <xsl:when test="$u = 7">семь </xsl:when>
            <xsl:when test="$u = 8">восемь </xsl:when>
            <xsl:when test="$u = 9">девять </xsl:when>
          </xsl:choose>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="$one">
        <xsl:call-template name="plural">
          <xsl:with-param name="n" select="$t"/>
          <xsl:with-param name="one" select="$one"/>
          <xsl:with-param name="few" select="$few"/>
          <xsl:with-param name="many" select="$many"/>
        </xsl:call-template>
        <xsl:text> </xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="plural">
    <xsl:param name="n"/>
    <xsl:param name="one"/>
    <xsl:param name="few"/>
    <xsl:param name="many"/>
    <xsl:variable name="r100" select="$n mod 100"/>
    <xsl:variable name="r10" select="$n mod 10"/>
    <xsl:choose>
      <xsl:when test="$r100 &gt;= 11 and $r100 &lt;= 14"><xsl:value-of select="$many"/></xsl:when>
      <xsl:when test="$r10 = 1"><xsl:value-of select="$one"/></xsl:when>
      <xsl:when test="$r10 &gt;= 2 and $r10 &lt;= 4"><xsl:value-of select="$few"/></xsl:when>
      <xsl:otherwise><xsl:value-of select="$many"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- ================================================================ приложение: маркировка -->

  <!-- Коды маркировки, упаковок, РНПТ и номера в других ГИС по строкам — отдельной страницей.
       В официальной форме УПД места для них нет, а при приёмке их сверяют. -->
  <xsl:template name="marking-appendix">
    <xsl:param name="table"/>
    <xsl:param name="title"/>
    <xsl:variable name="rows" select="$table/СведТов[ДопСведТов/НомСредИдентТов or ДопСведТов/СведПрослеж or ДопСведТов/СвГосСист]"/>
    <xsl:if test="$rows">
      <article class="page appendix">
        <h2>Приложение. Средства идентификации товаров и прослеживаемость</h2>
        <p class="subtitle"><xsl:value-of select="$title"/></p>
        <table class="codes">
          <thead>
            <tr>
              <th class="c">№ стр.</th>
              <th>Наименование товара</th>
              <th>Вид</th>
              <th>Код</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="$rows">
              <xsl:variable name="row" select="."/>
              <xsl:variable name="dop" select="ДопСведТов"/>
              <xsl:for-each select="$dop/НомСредИдентТов/КИЗ | $dop/НомСредИдентТов/НомУпак | $dop/НомСредИдентТов/@ИдентТрансУпак | $dop/НомСредИдентТов/@КолВедМарк | $dop/СведПрослеж/@НомТовПрослеж | $dop/СвГосСист/ИдНомУчетЕд">
                <tr>
                  <xsl:if test="position() = 1"><xsl:attribute name="class">first</xsl:attribute></xsl:if>
                  <td class="c">
                    <xsl:if test="position() = 1"><xsl:value-of select="$row/@НомСтр"/></xsl:if>
                  </td>
                  <td>
                    <xsl:if test="position() = 1">
                      <xsl:value-of select="$row/@НаимТов"/>
                      <div class="note">
                        <xsl:if test="$dop/@ГТИН">
                          <xsl:text>GTIN </xsl:text><xsl:value-of select="$dop/@ГТИН"/><xsl:text>; </xsl:text>
                        </xsl:if>
                        <xsl:text>кол-во </xsl:text>
                        <xsl:value-of select="$row/@КолТов"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$row/@НаимЕдИзм"/>
                        <xsl:if test="$dop/НомСредИдентТов/КИЗ">
                          <xsl:text>; КИЗ: </xsl:text>
                          <xsl:value-of select="count($dop/НомСредИдентТов/КИЗ)"/>
                        </xsl:if>
                      </div>
                    </xsl:if>
                  </td>
                  <td class="kind">
                    <xsl:choose>
                      <xsl:when test="local-name() = 'КИЗ'">КИЗ</xsl:when>
                      <xsl:when test="local-name() = 'НомУпак'">Упаковка</xsl:when>
                      <xsl:when test="local-name() = 'ИдентТрансУпак'">Трансп. упаковка</xsl:when>
                      <xsl:when test="local-name() = 'КолВедМарк'">Кол-во в ед. маркировки</xsl:when>
                      <xsl:when test="local-name() = 'НомТовПрослеж'">РНПТ</xsl:when>
                      <xsl:otherwise><xsl:value-of select="../@НаимГосСист"/></xsl:otherwise>
                    </xsl:choose>
                  </td>
                  <td class="code"><xsl:value-of select="."/></td>
                </tr>
              </xsl:for-each>
            </xsl:for-each>
          </tbody>
        </table>
        <p class="appendix-total">
          <xsl:text>Всего кодов КИЗ: </xsl:text>
          <xsl:value-of select="count($table/СведТов/ДопСведТов/НомСредИдентТов/КИЗ)"/>
          <xsl:text>; упаковок: </xsl:text>
          <xsl:value-of select="count($table/СведТов/ДопСведТов/НомСредИдентТов/НомУпак | $table/СведТов/ДопСведТов/НомСредИдентТов/@ИдентТрансУпак)"/>
          <xsl:text>.</xsl:text>
        </p>
      </article>
    </xsl:if>
  </xsl:template>

  <xsl:template name="css-appendix">
    <xsl:text>
.appendix { margin-top: 24px; }
.appendix h2 { font-size: 11pt; margin: 0 0 2px; }
.appendix .subtitle { margin: 0 0 8px; color: #444; font-size: 8.5pt; }
table.codes { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8pt; }
.codes th, .codes td { border: 1px solid #000; padding: 2px 4px; vertical-align: top; text-align: left; }
.codes th { background: #f3f3f3; font-weight: bold; }
.codes .c { width: 12mm; text-align: center; }
.codes .kind { width: 32mm; white-space: nowrap; }
.codes .code { font-family: "Consolas", "Courier New", monospace; word-break: break-all; }
.codes .note { color: #444; font-size: 7pt; }
.codes tr.first td { border-top: 1.5px solid #000; }
.appendix-total { margin: 6px 0 0; font-weight: bold; font-size: 8.5pt; }
@media print {
  .appendix { margin-top: 0; break-before: page; }
}
</xsl:text>
  </xsl:template>

  <!-- ================================================================ стили -->

  <xsl:template name="css-base">
    <xsl:text>
@page { size: A4 portrait; margin: 15mm 12mm 15mm 20mm; }
* { box-sizing: border-box; }
html { background: #e9e9ec; }
body { margin: 0; padding: 24px 0; font: 10.5pt/1.35 Arial, "Helvetica Neue", sans-serif; color: #000; }
.page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 12mm 15mm 20mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.25); }
h1 { font-size: 14pt; margin: 0 0 2px; padding-bottom: 6px; border-bottom: 2px solid #000; }
.subtitle { margin: 4px 0 10px; color: #444; font-size: 9pt; }
.parties { width: 100%; border-collapse: collapse; margin: 10px 0 12px; }
.parties th { width: 92px; text-align: left; vertical-align: top; font-weight: normal; padding: 3px 8px 3px 0; }
.parties td { padding: 3px 0; }
table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; }
.items th, .items td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
.items th { text-align: center; font-weight: bold; background: #f3f3f3; }
.items .num { width: 28px; text-align: center; }
.items .qty { width: 60px; text-align: right; white-space: nowrap; }
.items .unit { width: 60px; text-align: center; white-space: nowrap; }
.items .money { width: 96px; text-align: right; white-space: nowrap; }
.items .note { color: #444; font-size: 9pt; }
.totals { margin: 6px 0 0 auto; border-collapse: collapse; font-weight: bold; }
.totals th { text-align: right; padding: 1px 10px 1px 0; }
.totals td { text-align: right; width: 96px; padding: 1px 5px; white-space: nowrap; }
.summary { margin: 14px 0 0; }
.words { margin: 2px 0 0; font-weight: bold; }
.statement { margin: 14px 0 0; padding-bottom: 10px; border-bottom: 2px solid #000; }
.signatures { width: 100%; border-collapse: collapse; margin-top: 18px; table-layout: fixed; }
.signatures td { vertical-align: top; padding-right: 24px; }
.signatures .role { font-weight: bold; text-transform: uppercase; }
.signatures .post { min-height: 1.35em; margin: 4px 0 18px; font-size: 9.5pt; }
.signatures .line { display: flex; align-items: flex-end; gap: 8px; }
.signatures .blank { flex: 1; border-bottom: 1px solid #000; height: 1px; }
.signatures .who { white-space: nowrap; min-width: 6em; }
.meta { margin-top: 28px; padding-top: 6px; border-top: 1px dashed #999; color: #555; font-size: 7.5pt; }
.meta .file-id { word-break: break-all; }
.warn, .error { width: 210mm; margin: 0 auto 12px; padding: 8px 12px; background: #fff4ce; border: 1px solid #e0b400; }
.error { background: #fde7e9; border-color: #d13438; }

@media screen and (max-width: 820px) {
  body { padding: 0; font-size: 13px; }
  .page { width: auto; min-height: 0; padding: 16px 12px; box-shadow: none; }
  .warn, .error { width: auto; margin: 0 0 8px; }
  .items { font-size: 11.5px; }
  .items th, .items td { padding: 3px 3px; }
  .items .num, .items .money, .items .unit, .items .qty { width: auto; }
  .totals td { width: auto; }
  .signatures td { display: block; padding: 0 0 16px; }
}

@media print {
  html, body { background: #fff; padding: 0; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .warn { display: none; }
  tr { break-inside: avoid; }
}
</xsl:text>
  </xsl:template>

</xsl:stylesheet>

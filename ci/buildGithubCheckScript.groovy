@Grab(group='io.jsonwebtoken', module='jjwt', version='0.4')
import sun.net.www.protocol.https.HttpsURLConnectionImpl
import java.text.SimpleDateFormat
import java.lang.reflect.*
import java.util.*
import java.nio.charset.StandardCharsets
import java.io.*
import javax.crypto.KeyGenerator
import java.security.*
import groovy.json.*
import io.jsonwebtoken.*
import java.security.interfaces.RSAPrivateKey
import java.security.spec.*
import static io.jsonwebtoken.SignatureAlgorithm.RS256
import java.util.Base64.Decoder
import org.apache.commons.codec.binary.Base64
import org.codehaus.groovy.runtime.GStringImpl

APP_ID = <APP_ID>
INSTALLATION_ID = <INSTALLATION_ID>
ORGANIZATION_NAME = <ORGANIZATION_NAME>

// Custom HTTP request method
def setRequestMethod( HttpURLConnection c,  String requestMethod) {
    try {
        final Object target;
        if (c instanceof HttpsURLConnectionImpl) {
            final Field delegate = HttpsURLConnectionImpl.class.getDeclaredField("delegate");
            delegate.setAccessible(true);
            target = delegate.get(c);
        } else {
            target = c;
        }
        final Field f = HttpURLConnection.class.getDeclaredField("method");
        f.setAccessible(true);
        f.set(target, requestMethod);
    } catch (IllegalAccessException | NoSuchFieldException ex) {
        throw new AssertionError(ex);
    }
}

def getPreviousCheckNameRunID(repository, commitID, token, checkName) {
    try {
        def httpConn = new URL("https://api.github.com/repos/${ORGANIZATION_NAME}/${repository}/commits/${commitID}/check-runs").openConnection();
        httpConn.setDoOutput(true)
        httpConn.setRequestProperty( 'Authorization', "token ${token}" )
        httpConn.setRequestProperty( 'Accept', 'application/vnd.github.antiope-preview+json' )
        checkRuns = httpConn.getInputStream().getText();
        def slurperCheckRun = new JsonSlurper()
        def resultMapCheckRun = slurperCheckRun.parseText(checkRuns)
        def check_run_id = resultMapCheckRun.check_runs
                      .find { it.name == checkName }
                      .id
        return check_run_id
    } catch(Exception e){
        error 'Failed to retrieve the check id'
    }
}

def setCheckName(repository, checkName, status, previousDay, requestMethod, commitID=null, check_run_id=null) {
    try {
        def jsonCheckRun = new groovy.json.JsonBuilder()
        updateCheckRun = ["name":"${checkName}", "status": "in_progress", "conclusion":"${status}", "completed_at": "${previousDay}"]
        def url = "https://api.github.com/repos/${ORGANIZATION_NAME}/${repository}/check-runs"

        if (requestMethod == "POST") {
            updateCheckRun["head_sha"] = "${commitID}"
        } else {
            url += "/${check_run_id}"
        }

        // Cast map to json
        jsonCheckRun updateCheckRun

        def httpConn = new URL(url).openConnection();
        setRequestMethod(httpConn, requestMethod);
        httpConn.setDoOutput(true)
        httpConn.setRequestProperty( 'Authorization', "token ${token}" )
        httpConn.setRequestProperty( 'Accept', 'application/vnd.github.antiope-preview+json' )
        httpConn.getOutputStream().write(jsonCheckRun.toString().getBytes("UTF-8"));
        return httpConn.getResponseCode();
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Failed to create a check run"
    }
}

def getRSAPrivateKey(privateKey) {
    try {
        String privateKeyPEM = readFile privateKey
        privateKeyPEM = privateKeyPEM.replace("-----BEGIN CERTIFICATE-----\n", "");
        privateKeyPEM = privateKeyPEM.replace("-----END CERTIFICATE-----", "");

        byte[] encoded = Base64.decodeBase64(privateKeyPEM);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(encoded);
        RSAPrivateKey privKey = (RSAPrivateKey) kf.generatePrivate(keySpec);
        return privKey
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Failed to create a RSAPrivateKey"
    }
}

def accessTime() {
    try {
        Date date = new Date();
        long t = date.getTime();
        Date expirationTime = new Date(t + 50000l);
        Date iat = new Date(System.currentTimeMillis() + 1000)
        return ["iat": iat, "expirationTime": expirationTime]
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Generated current time failed"
    }
}

def validateAuth(jsonWebToken) {
    try {
        def httpConn = new URL("https://api.github.com/app").openConnection();
        httpConn.setRequestProperty( 'Authorization', "Bearer ${jsonWebToken}" )
        httpConn.setRequestProperty( 'Accept', 'application/vnd.github.machine-man-preview+json' )
        return httpConn.getResponseCode();
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Authentication request failed"
    }
}

def getToken(jsonWebToken) {
    try {
        def httpConn = new URL("https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens").openConnection();
        httpConn.setRequestProperty( 'Authorization', "Bearer ${jsonWebToken}" )
        httpConn.setRequestProperty( 'Accept', 'application/vnd.github.machine-man-preview+json' )
        httpConn.setRequestMethod("POST");
        def responseText = httpConn.getInputStream().getText()
        def slurper = new JsonSlurper()
        def resultMap = slurper.parseText(responseText)
        def token = resultMap["token"]
        return token
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Failed to get a token"
    }
}

def getJsonWebToken(privateKey) {
    try {
        privateCrtKey = getRSAPrivateKey(privateKey)
        time = accessTime()
        def jsonWebToken = Jwts.builder()
        .setSubject("RS256")
        .signWith(RS256, privateCrtKey)
        .setExpiration(time['expirationTime'])
        .setIssuedAt(time['iat'])
        .setIssuer(APP_ID)
        .compact()
        return jsonWebToken
    } catch(Exception e){
        echo "Exception: ${e}"
        error "Failed to create a JWT"
    }
}

def buildGithubCheck(repository, commitID, privateKey, status, checkName) {
    def currentTime = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'")
    def checkName_run_id

    jsonWebToken = getJsonWebToken(privateKey)
    getStatusCode = validateAuth(jsonWebToken)
    if (!(getStatusCode in [200,201])) {
        error "Authentication request failed, status code: ${getStatusCode}"
    }
    token = getToken(jsonWebToken)

    try {
        checkName_run_id = getPreviousCheckNameRunID(repository, commitID, token, checkName)
    } catch(Exception e) {
        echo "Exception: ${e}"
        echo "Check name does not exist"
    }

    if (checkName_run_id) {
        getStatusCode = setCheckName(repository, checkName, status, currentTime, "PATCH", commitID, checkName_run_id)
    } else {
        getStatusCode = setCheckName(repository, checkName, status, previousDay, "POST", commitID)
    }
    if (!(getStatusCode in [200,201])) {
        error "Failed to create a check run, status code: ${getStatusCode}"
    }
}

return this;
